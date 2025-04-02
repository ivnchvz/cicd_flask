pipeline {
    agent any
    environment {
        AWS_REGION = 'us-east-1'
        KEY_NAME = "jenkins-deploy-key-${BUILD_NUMBER}"
    }
    stages {
        stage('Generate SSH Key') {
            steps {
                withCredentials([aws(credentialsId: 'aws-creds')]) {
                    sh '''
                        # Remove any existing keys in the workspace's keys directory
                        rm -f ${WORKSPACE}/keys/ec2_key ${WORKSPACE}/keys/ec2_key.pub
                        
                        # Generate a new SSH key
                        mkdir -p ${WORKSPACE}/keys
                        ssh-keygen -t rsa -b 2048 -f ${WORKSPACE}/keys/ec2_key -N ""
                        
                        # Import the key to AWS
                        aws ec2 import-key-pair --key-name ${KEY_NAME} --public-key-material fileb://${WORKSPACE}/keys/ec2_key.pub --region ${AWS_REGION}
                    '''
                }
            }
        }
        
        stage('Terraform Apply') {
            agent {
                docker {
                    image 'hashicorp/terraform:latest'
                    args '-u 0 -v ${WORKSPACE}:/workspace -w /workspace/terraform'
                }
            }
            steps {
                withCredentials([aws(credentialsId: 'aws-creds')]) {
                    sh """
                        # Update the terraform file to include key_name
                        sed -i 's/instance_type = "t2.micro"/instance_type = "t2.micro"\\n  key_name = "${KEY_NAME}"/' main.tf
                        
                        terraform init
                        terraform apply -auto-approve
                    """
                }
            }
        }
        
        stage('Ansible Deployment') {
            agent {
                docker {
                    image 'cytopia/ansible:latest'
                    args '-u 0 -v ${WORKSPACE}:/workspace -w /workspace/ansible'
                }
            }
            steps {
                withCredentials([aws(credentialsId: 'aws-creds')]) {
                    script {
                        def ec2_ip = sh(script: "cd /workspace/terraform && terraform output -raw instance_ip", returnStdout: true).trim()
                        
                        // Wait for instance to be fully initialized
                        sh "sleep 45"
                        
                        sh """
                            chmod 600 /workspace/keys/ec2_key
                            ansible-playbook -i ${ec2_ip}, -u ec2-user --private-key /workspace/keys/ec2_key --ssh-common-args='-o StrictHostKeyChecking=no' playbook.yml
                        """

                         // Display application endpoints
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
                        # Delete the temporary key from AWS
                        aws ec2 delete-key-pair --key-name ${KEY_NAME} --region ${AWS_REGION}
                        
                        # Remove key files
                        rm -f ${WORKSPACE}/keys/ec2_key ${WORKSPACE}/keys/ec2_key.pub
                    """
                }
            }
        }
    }
}