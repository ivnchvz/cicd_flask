pipeline {
    agent any
    environment {
        AWS_REGION = 'us-east-1'
        KEY_NAME = "jenkins-deploy-key-${BUILD_NUMBER}"
        KEY_PATH = "${WORKSPACE}/keys/ec2_key"  // Define a consistent key path
        GLOBAL_WORKSPACE = "${WORKSPACE}"       // Capture the main workspace path
    }
    stages {
        stage('Generate SSH Key') {
            steps {
                withCredentials([aws(credentialsId: 'aws-creds')]) {
                    sh '''
                        rm -f ${KEY_PATH} ${KEY_PATH}.pub
                        mkdir -p ${WORKSPACE}/keys
                        ssh-keygen -t rsa -b 2048 -f ${KEY_PATH} -N ""
                        aws ec2 import-key-pair --key-name ${KEY_NAME} --public-key-material fileb://${KEY_PATH}.pub --region ${AWS_REGION}
                    '''
                }
            }
        }
        
        stage('Terraform Apply') {
            agent {
                docker {
                    image 'hashicorp/terraform:latest'
                    args '-u 0 -v ${WORKSPACE}:/workspace -v /var/run/docker.sock:/var/run/docker.sock --entrypoint=""'
                }
            }
            steps {
                withCredentials([aws(credentialsId: 'aws-creds')]) {
                    dir('terraform') {
                        sh """
                            echo "Current directory:"
                            pwd
                            
                            echo "Directory contents:"
                            ls -la
                            
                            echo "Initializing Terraform..."
                            terraform init
                            
                            echo "Planning Terraform changes..."
                            terraform plan -var="key_name=${KEY_NAME}" -out=tfplan
                            
                            echo "Applying Terraform changes..."
                            terraform apply -auto-approve tfplan || (echo "Terraform apply failed" && exit 1)
                            
                            echo "Getting instance IP..."
                            # Save to an absolute path that will be accessible to all stages
                            terraform output -raw instance_ip > ${GLOBAL_WORKSPACE}/instance_ip.txt
                            
                            echo "Instance IP:"
                            cat ${GLOBAL_WORKSPACE}/instance_ip.txt
                            
                            echo "Terraform state list:"
                            terraform state list
                            
                            # Only try to show details if instance actually exists in state
                            if terraform state list | grep -q "aws_instance.example"; then
                                echo "EC2 instance details from Terraform:"
                                terraform state show aws_instance.example
                            else
                                echo "Instance not found with expected resource name. Available resources:"
                                terraform state list
                            fi
                        """
                    }
                }
            }
        }
        
        stage('Verify EC2 Instance') {
            steps {
                withCredentials([aws(credentialsId: 'aws-creds')]) {
                    script {
                        def ec2_ip = sh(script: "cat ${WORKSPACE}/instance_ip.txt", returnStdout: true).trim()
                        sh """
                            echo "Verifying EC2 instance with IP: ${ec2_ip}..."
                            
                            # Check if EC2 instance is running
                            aws ec2 describe-instances --region ${AWS_REGION} --filters "Name=ip-address,Values=${ec2_ip}" --query 'Reservations[*].Instances[*].[InstanceId,State.Name]' --output table
                            
                            # Wait for instance to be accessible via SSH
                            echo "Waiting for SSH access..."
                            timeout 180 bash -c 'until nc -z ${ec2_ip} 22; do sleep 5; echo "Waiting for SSH..."; done' || (echo "Failed to connect to instance via SSH" && exit 1)
                        """
                    }
                }
            }
        }
        
        stage('Ansible Deployment') {
            agent {
                docker {
                    image 'cytopia/ansible:2.9-tools'
                    args '-u 0 -v ${WORKSPACE}:/workspace --entrypoint=""'
                }
            }
            steps {
                withCredentials([aws(credentialsId: 'aws-creds')]) {
                    script {
                        def ec2_ip = sh(script: "cat ${WORKSPACE}/instance_ip.txt", returnStdout: true).trim()
                        sh "sleep 45"  // Wait for instance to be ready
                        sh """
                            apk add --no-cache openssh-client
                            ls -la
                            chmod 600 ${KEY_PATH}
                            
                            echo "Running Ansible playbook..."
                            cd ansible
                            
                            # Set higher verbosity for debugging
                            ANSIBLE_HOST_KEY_CHECKING=False ansible-playbook -vvv -i ${ec2_ip}, -u ec2-user --private-key ${KEY_PATH} --ssh-common-args='-o StrictHostKeyChecking=no' playbook.yml
                            if [ \$? -ne 0 ]; then
                                echo "Ansible playbook failed, collecting debug information..."
                                ANSIBLE_HOST_KEY_CHECKING=False ansible -i ${ec2_ip}, -u ec2-user --private-key ${KEY_PATH} --ssh-common-args='-o StrictHostKeyChecking=no' -m shell -a "docker ps -a" all || echo "Cannot connect to get Docker status"
                                ANSIBLE_HOST_KEY_CHECKING=False ansible -i ${ec2_ip}, -u ec2-user --private-key ${KEY_PATH} --ssh-common-args='-o StrictHostKeyChecking=no' -m shell -a "ls -la /app" all || echo "Cannot check app directory"
                                exit 1
                            fi
                        """
                        
                        echo "========================================"
                        echo "Application deployed successfully!"
                        echo "Frontend endpoint: http://${ec2_ip}:3000"
                        echo "Backend endpoint: http://${ec2_ip}:5001"
                        echo "========================================"
                    }
                }
            }
        }
        
        stage('Cleanup') {
            steps {
                withCredentials([aws(credentialsId: 'aws-creds')]) {
                    sh """
                        echo "Cleaning up resources..."
                        
                        # Try to delete key pair, but don't fail if it doesn't exist or if permission is denied
                        aws ec2 delete-key-pair --key-name ${KEY_NAME} --region ${AWS_REGION} || echo "Warning: Could not delete key pair. Check IAM permissions."
                        
                        echo "Removing local files..."
                        rm -f ${KEY_PATH} ${KEY_PATH}.pub
                        rm -f ${WORKSPACE}/instance_ip.txt
                    """
                }
            }
        }
    }
    post {
        always {
            echo "Pipeline completed with status: ${currentBuild.result}"
        }
        failure {
            script {
                echo "Pipeline failed. Attempting to clean up any resources that might have been created."
                withCredentials([aws(credentialsId: 'aws-creds')]) {
                    try {
                        // Try to identify if an instance was created using the key name
                        sh """
                            echo "Looking for instances using key ${KEY_NAME}..."
                            INSTANCE_IDS=\$(aws ec2 describe-instances --region ${AWS_REGION} --filters "Name=key-name,Values=${KEY_NAME}" --query 'Reservations[*].Instances[*].InstanceId' --output text)
                            if [ ! -z "\$INSTANCE_IDS" ]; then
                                echo "Found instances: \$INSTANCE_IDS. Attempting to terminate..."
                                aws ec2 terminate-instances --instance-ids \$INSTANCE_IDS --region ${AWS_REGION} || echo "Could not terminate instances: \$INSTANCE_IDS"
                            else
                                echo "No instances found with key ${KEY_NAME}"
                            fi
                            
                            # Try to delete the key pair but don't fail the pipeline if it doesn't work
                            aws ec2 delete-key-pair --key-name ${KEY_NAME} --region ${AWS_REGION} || echo "Could not delete key pair ${KEY_NAME}"
                        """
                    } catch (Exception e) {
                        echo "Error during cleanup: ${e.message}"
                    }
                }
            }
        }
    }
}