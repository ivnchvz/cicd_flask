provider "aws" {
  region = "us-east-1"
}

# Variable for key name which will be passed from the pipeline
variable "key_name" {
  description = "Name of the SSH key pair to use"
  type        = string
  default     = "default-key" # This default is just a fallback
}

resource "aws_instance" "example" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t2.micro"
  key_name      = var.key_name  # Add this line to use the SSH key

  # Add a security group rule to allow SSH access
  vpc_security_group_ids = [aws_security_group.instance.id]

  tags = {
    Name = "TestInstance"
  }
}

# Security group to allow SSH access
resource "aws_security_group" "instance" {
  name        = "allow-app-access"
  description = "Allow SSH and application access"

  ingress {
    description = "SSH from anywhere"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Frontend access"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Backend access"
    from_port   = 5001
    to_port     = 5001
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "allow-app-access"
  }
}

output "instance_ip" {
  value = aws_instance.example.public_ip
}