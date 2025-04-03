pipeline {
    agent any
    environment {
        AWS_REGION = 'us-east-1'
        KEY_NAME = "jenkins-deploy-key-${BUILD_NUMBER}"
        KEY_PATH = "${WORKSPACE}/keys/ec2_key"
    }
    stages {
        stage('Generate SSH Key') {
            steps {
                withCredentials([aws(credentialsId: 'aws-creds')]) {
                    sh '''
                        mkdir -p ${WORKSPACE}/keys
                        ssh-keygen -t rsa -b 2048 -f ${KEY_PATH} -N ""
                        aws ec2 import-key-pair --key-name ${KEY_NAME} \
                          --public-key-material fileb://${KEY_PATH}.pub \
                          --region ${AWS_REGION}
                    '''
                }
            }
        }

        stage('Terraform Apply') {
            agent {
                docker {
                    image 'hashicorp/terraform:latest'
                    args '-v ${WORKSPACE}:/workspace --entrypoint=""'
                }
            }
            steps {
                withCredentials([aws(credentialsId: 'aws-creds')]) {
                    dir('terraform') {
                        sh """
                            terraform init
                            terraform apply -auto-approve -var='key_name=${KEY_NAME}'
                            terraform output -raw instance_ip > /workspace/instance_ip.txt
                            echo 'Instance IP saved:'
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
                        def ec2_ip = readFile("${WORKSPACE}/instance_ip.txt").trim()
                        sh """
                            echo 'Verifying SSH access to ${ec2_ip}...'
                            timeout 300 bash -c '
                                until ssh -o StrictHostKeyChecking=no -i ${KEY_PATH} ec2-user@${ec2_ip} "echo Connected"; do
                                    sleep 10
                                done'
                        """
                    }
                }
            }
        }

        stage('Ansible Deployment') {
            agent {
                docker {
                    image 'cytopia/ansible:2.9-tools'
                    args '-v ${WORKSPACE}:/workspace --entrypoint=""'
                }
            }
            steps {
                script {
                    def ec2_ip = readFile("${WORKSPACE}/instance_ip.txt").trim()
                    sh """
                        ansible-playbook -i '${ec2_ip},' \
                          -u ec2-user \
                          --private-key /workspace/keys/ec2_key \
                          /workspace/ansible/playbook.yml
                    """
                }
            }
        }

        stage('Cleanup') {
            steps {
                withCredentials([aws(credentialsId: 'aws-creds')]) {
                    sh """
                        aws ec2 delete-key-pair --key-name ${KEY_NAME} --region ${AWS_REGION} || true
                        rm -f ${KEY_PATH} ${KEY_PATH}.pub ${WORKSPACE}/instance_ip.txt
                    """
                }
            }
        }
    }
    post {
        failure {
            script {
                withCredentials([aws(credentialsId: 'aws-creds')]) {
                    sh """
                        INSTANCE_IDS=\$(aws ec2 describe-instances \
                          --region ${AWS_REGION} \
                          --filters Name=key-name,Values=${KEY_NAME} \
                          --query "Reservations[*].Instances[*].InstanceId" \
                          --output text)
                        aws ec2 terminate-instances --instance-ids \$INSTANCE_IDS --region ${AWS_REGION} || true
                    """
                }
            }
        }
    }
}