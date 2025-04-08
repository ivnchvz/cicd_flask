provider "aws" {
  region = var.aws_region  # Use variable instead of hardcoding
}

# Data source to fetch the latest Amazon Linux 2 AMI
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]  # AMIs owned by Amazon

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]  # Pattern for Amazon Linux 2 HVM, EBS-backed
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]  # Hardware Virtual Machine, compatible with t2.micro
  }

  filter {
    name   = "root-device-type"
    values = ["ebs"]  # EBS-backed instances are Free Tier-eligible
  }
}

# Variable for key name which will be passed from the pipeline
variable "key_name" {
  description = "Name of the SSH key pair to use"
  type        = string
  default     = "default-key"  # This default is just a fallback
}

resource "aws_instance" "example" {
  ami                    = data.aws_ami.amazon_linux.id  # Dynamic AMI ID
  instance_type          = var.instance_type             # Use variable for Free Tier flexibility
  key_name               = var.key_name                  # Passed from Jenkins pipeline
  vpc_security_group_ids = [aws_security_group.instance.id]

  tags = {
    Name = "TestInstance"
  }
}

# Security group to allow SSH and application access
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
    from_port   = 5000
    to_port     = 5000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"  # All protocols
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "allow-app-access"
  }
}

output "instance_ip" {
  value = aws_instance.example.public_ip
}