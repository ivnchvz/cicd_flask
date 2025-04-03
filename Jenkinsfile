pipeline {
    agent any
    environment {
        AWS_REGION = 'us-east-1'
        KEY_NAME = "jenkins-deploy-key-${BUILD_NUMBER}"
        KEY_PATH = "${WORKSPACE}/keys/ec2_key"
        GLOBAL_WORKSPACE = "${WORKSPACE}"
    }
    stages {
        stage('Generate SSH Key') {
            steps {
                withCredentials([aws(credentialsId: 'aws-creds')]) {
                    sh '''
                        rm -f ${KEY_PATH} ${KEY_PATH}.pub
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
                    args '-u 0 -v ${WORKSPACE}:/workspace -v /var/run/docker.sock:/var/run/docker.sock --entrypoint=""'
                }
            }
            steps {
                withCredentials([aws(credentialsId: 'aws-creds')]) {
                    dir('terraform') {
                        sh """
                            terraform init
                            terraform plan -var="key_name=${KEY_NAME}" -out=tfplan
                            terraform apply -auto-approve tfplan
                            
                            # Write IP to host workspace
                            terraform output -raw instance_ip > ${GLOBAL_WORKSPACE}/instance_ip.txt
                            
                            echo "=== TERRAFORM VALIDATION ==="
                            echo "Instance IP:"
                            cat ${GLOBAL_WORKSPACE}/instance_ip.txt
                            echo "Workspace Contents:"
                            ls -la ${GLOBAL_WORKSPACE}/
                        """
                    }
                }
            }
        }

        stage('Verify EC2 Instance') {
            steps {
                withCredentials([aws(credentialsId: 'aws-creds')]) {
                    script {
                        def ec2_ip = sh(script: "cat ${GLOBAL_WORKSPACE}/instance_ip.txt", returnStdout: true).trim()
                        sh """
                            echo "=== SSH VERIFICATION ==="
                            echo "Testing connection to ${ec2_ip}"
                            timeout 300 bash -c '
                                for i in {1..30}; do
                                    ssh -o ConnectTimeout=10 \
                                      -o StrictHostKeyChecking=no \
                                      -i ${KEY_PATH} \
                                      ec2-user@${ec2_ip} "echo SSH_SUCCESS" && exit 0
                                    sleep 10
                                    echo "Attempt \$i/30: Waiting for SSH..."
                                done
                                echo "SSH failed after 30 attempts"
                                exit 1'
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
                            echo "=== ANSIBLE PREFLIGHT CHECK ==="
                            echo "IP Address: ${ec2_ip}"
                            echo "SSH Key Path: /workspace/keys/ec2_key"
                            ls -la /workspace/keys/ec2_key
                            chmod 600 /workspace/keys/ec2_key
                            
                            echo "=== ANSIBLE EXECUTION ==="
                            cd /workspace/ansible
                            ANSIBLE_HOST_KEY_CHECKING=False ansible-playbook -vvv \
                              -i '${ec2_ip},' \
                              -u ec2-user \
                              --private-key /workspace/keys/ec2_key \
                              --ssh-common-args='-o StrictHostKeyChecking=no' \
                              playbook.yml
                        """
                    }
                }
            }
        }

        stage('Cleanup') {
            steps {
                withCredentials([aws(credentialsId: 'aws-creds')]) {
                    sh """
                        echo "=== CLEANUP ==="
                        aws ec2 delete-key-pair --key-name ${KEY_NAME} --region ${AWS_REGION} || true
                        rm -fv ${KEY_PATH} ${KEY_PATH}.pub ${WORKSPACE}/instance_ip.txt
                    """
                }
            }
        }
    }
    post {
        always {
            echo "Pipeline Status: ${currentBuild.result}"
            sh "rm -fv ${WORKSPACE}/instance_ip.txt || true"
        }
        failure {
            script {
                withCredentials([aws(credentialsId: 'aws-creds')]) {
                    sh """
                        echo "=== EMERGENCY CLEANUP ==="
                        INSTANCE_IDS=\$(aws ec2 describe-instances \
                          --region ${AWS_REGION} \
                          --filters Name=key-name,Values=${KEY_NAME} \
                          --query "Reservations[*].Instances[*].InstanceId" \
                          --output text)
                        
                        if [ -n "\${INSTANCE_IDS}" ]; then
                            aws ec2 terminate-instances --instance-ids \${INSTANCE_IDS} --region ${AWS_REGION} || true
                        fi
                    """
                }
            }
        }
    }
}