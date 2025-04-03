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
                            terraform output -raw instance_ip >> /workspace/instance_ip.txt
                            
                            echo "Instance IP:"
                            cat /workspace/instance_ip.txt
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
                            aws ec2 describe-instances --region ${AWS_REGION} --filters "Name=ip-address,Values=${ec2_ip}" \
                              --query 'Reservations[*].Instances[*].[InstanceId,State.Name]' --output table
                            
                            echo "Waiting for SSH access..."
                            timeout 180 bash -c '
                                until ssh -o ConnectTimeout=5 \
                                -o StrictHostKeyChecking=no \
                                -i ${KEY_PATH} \
                                ec2-user@${ec2_ip} "echo SSH ready"; 
                                do 
                                    sleep 5; 
                                    echo "Waiting for SSH..."; 
                                done' || (echo "SSH connection failed" && exit 1)
                        """
                    }
                }
            }
        }
        
        stage('Ansible Deployment') {
            agent {
                docker {
                    image 'cytopia/ansible:2.9-tools'
                    args '-u 0 -v ${WORKSPACE}:/workspace -w /workspace --entrypoint=""'
                }
            }
            steps {
                withCredentials([aws(credentialsId: 'aws-creds')]) {
                    script {
                        def ec2_ip = sh(script: "cat /workspace/instance_ip.txt", returnStdout: true).trim()
                        sh """
                            sleep 45  # Extra buffer for instance initialization
                            apk add --no-cache openssh-client
                            echo "-----BEGIN DEBUG INFO-----"
                            echo "Current directory:"
                            pwd
                            echo "Workspace contents:"
                            ls -la /workspace/
                            echo "Using IP address: ${ec2_ip}"
                            echo "SSH key permissions:"
                            ls -la /workspace/keys/ec2_key
                            echo "-----END DEBUG INFO-----"
                            
                            chmod 600 /workspace/keys/ec2_key
                            cd /workspace/ansible
                            
                            ANSIBLE_HOST_KEY_CHECKING=False ansible-playbook -vvv \
                              -i '${ec2_ip},' \
                              -u ec2-user \
                              --private-key /workspace/keys/ec2_key \
                              --ssh-common-args='-o StrictHostKeyChecking=no' \
                              playbook.yml
                        """
                        echo "========================================"
                        echo "Application deployed successfully!"
                        echo "Frontend: http://${ec2_ip}:3000"
                        echo "Backend: http://${ec2_ip}:5001"
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
                        aws ec2 delete-key-pair --key-name ${KEY_NAME} --region ${AWS_REGION} || true
                        rm -f ${KEY_PATH} ${KEY_PATH}.pub ${WORKSPACE}/instance_ip.txt
                    """
                }
            }
        }
    }
    post {
        always {
            echo "Pipeline status: ${currentBuild.result}"
        }
        failure {
            script {
                withCredentials([aws(credentialsId: 'aws-creds')]) {
                    sh """
                        echo "Emergency cleanup..."
                        INSTANCE_IDS=\$(aws ec2 describe-instances \
                          --region ${AWS_REGION} \
                          --filters "Name=key-name,Values=${KEY_NAME}" \
                          --query "Reservations[*].Instances[*].InstanceId" \
                          --output text)
                        
                        if [ -n "\$INSTANCE_IDS" ]; then
                            aws ec2 terminate-instances --instance-ids \$INSTANCE_IDS --region ${AWS_REGION} || true
                        fi
                    """
                }
            }
        }
    }
}