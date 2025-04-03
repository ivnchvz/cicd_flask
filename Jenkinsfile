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
                        rm -f ${WORKSPACE}/keys/ec2_key ${WORKSPACE}/keys/ec2_key.pub
                        mkdir -p ${WORKSPACE}/keys
                        ssh-keygen -t rsa -b 2048 -f ${WORKSPACE}/keys/ec2_key -N ""
                        aws ec2 import-key-pair --key-name ${KEY_NAME} --public-key-material fileb://${WORKSPACE}/keys/ec2_key.pub --region ${AWS_REGION}
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
                            pwd
                            ls -la
                            terraform init
                            terraform apply -auto-approve -var="key_name=${KEY_NAME}"
                            # Save the IP address to a file that can be read in the next stage
                            terraform output -raw instance_ip > ${WORKSPACE}/instance_ip.txt
                        """
                    }
                }
            }
        }
        
        stage('Ansible Deployment') {
            agent {
                docker {
                    image 'cytopia/ansible:latest'
                    args '-u 0 -v ${WORKSPACE}:/workspace --entrypoint=""'
                }
            }
            steps {
                withCredentials([aws(credentialsId: 'aws-creds')]) {
                    script {
                        // Read the IP from the file saved in the previous stage
                        def ec2_ip = sh(script: "cat ${WORKSPACE}/instance_ip.txt", returnStdout: true).trim()
                        sh "sleep 45"  // Wait for instance to be ready
                        sh """
                            chmod 600 /workspace/keys/ec2_key
                            cd /workspace/ansible
                            ansible-playbook -i ${ec2_ip}, -u ec2-user --private-key /workspace/keys/ec2_key --ssh-common-args='-o StrictHostKeyChecking=no' playbook.yml
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
                        aws ec2 delete-key-pair --key-name ${KEY_NAME} --region ${AWS_REGION}
                        rm -f ${WORKSPACE}/keys/ec2_key ${WORKSPACE}/keys/ec2_key.pub
                        rm -f ${WORKSPACE}/instance_ip.txt
                    """
                }
            }
        }
    }
}