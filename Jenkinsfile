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
                        rm -f ${KEY_PATH} ${KEY_PATH}.pub
                        mkdir -p ${WORKSPACE}/keys
                        ssh-keygen -t rsa -b 2048 -f ${KEY_PATH} -N ""
                        aws ec2 import-key-pair --key-name ${KEY_NAME} --public-key-material fileb://${KEY_PATH}.pub --region ${AWS_REGION}
                    '''
                }
            }
        }

        stage('Build and Push Docker Images') {
            steps {
                withCredentials([usernamePassword(credentialsId: 'docker-hub-creds', usernameVariable: 'DOCKER_USERNAME', passwordVariable: 'DOCKER_PASSWORD')]) {
                    sh '''
                        # Log into Docker Hub
                        echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin

                        # Build and push frontend image
                        cd frontend
                        docker build -t wasserstiefel/iss-tracker-frontend:latest .
                        docker push wasserstiefel/iss-tracker-frontend:latest

                        # Build and push backend image
                        cd ../backend
                        docker build -t wasserstiefel/iss-tracker-backend:latest .
                        docker push wasserstiefel/iss-tracker-backend:latest
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
                            terraform apply -auto-approve -var=\"key_name=${KEY_NAME}\"
                            terraform output -raw instance_ip > ${WORKSPACE}/instance_ip.txt
                            terraform output -raw domain_name > ${WORKSPACE}/domain_name.txt
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
                withCredentials([
                    aws(credentialsId: 'aws-creds'),
                    usernamePassword(credentialsId: 'docker-hub-creds', usernameVariable: 'DOCKER_USERNAME', passwordVariable: 'DOCKER_PASSWORD')
                ]) {
                    script {
                        def ec2_ip = sh(script: "cat ${WORKSPACE}/instance_ip.txt", returnStdout: true).trim()
                        def domain_name = sh(script: "cat ${WORKSPACE}/domain_name.txt", returnStdout: true).trim()
                        sh "sleep 45"
                        sh """
                            apk add --no-cache openssh-client
                            ls -la
                            chmod 600 ${KEY_PATH}
                            pwd
                            cd ansible
                            ansible-playbook -i ${ec2_ip}, -u ec2-user --private-key ${KEY_PATH} --ssh-common-args='-o StrictHostKeyChecking=no' --extra-vars "docker_username=${DOCKER_USERNAME} docker_password=${DOCKER_PASSWORD}" playbook.yml
                        """
                        echo "========================================"
                        echo "Application deployed successfully!"
                        echo "Frontend endpoint: http://${domain_name}"  // Now iss.ivnchvz.com
                        echo "Backend endpoint: http://${domain_name}:5000"
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
                        rm -f ${KEY_PATH} ${KEY_PATH}.pub
                        rm -f ${WORKSPACE}/instance_ip.txt
                        rm -f ${WORKSPACE}/domain_name.txt
                    """
                }
            }
        }
    }
}