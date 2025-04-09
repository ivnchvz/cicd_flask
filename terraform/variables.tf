variable "key_name" {
  description = "Name of the SSH key pair to use"
  type        = string
}

variable "aws_region" {
  default = "us-east-1"
}

variable "instance_type" {
  default = "t2.micro"
}

variable "domain_name" {
  default = "ivnchvz.com"
}

variable "subdomain" {
  default = "iss"
}