# ISS Tracker 
<pre>
                                                                           hello@you
                                                                           ----------
     -+#                                                                   Project: cicd_flask
  .--+######                                                               Owner: ivnchvz
 ++++##########                         ------                             Repo: github.com/ivnchvz/cicd_flask
######+++#########             ..    --------+#                            Language: Python, Javascript
#########+++##########         ---+-------++++#                            Framework: Flask, NextJS
   ##########+++#########     ---------+#####                              Cloud: AWS
      ##########++++#######--------++####                                  CI/CD: Jenkins
          ##########++++++-----+++#####                                    Infraestructure: Terraform, Ansible
             ########+-------++++########                                  Container: Docker
             ----+-------+++######++#########                              SCM: Github
             --------++++##++########+++#########                          Description: ISS tracker in real time
              +++++-+###---.-+++++######+++########                        Live: iss.ivnchvz.com
              #######      .------+#########++#########                    Status: Active
                             --+#     ##########+######   
                                         ##########+++-   
                                            ##########+--#                 █████████▓▓▓▓▓▓▒▒▒▒█████▓▓▓▓▓▓▓▓▒▒▒▒▒
                                                 #######                   ▓▓▓▓▓▓▓▓▓▓▒▒▒▒▒░░░░█████▓▓▓▓▒▒▒▒▒░░░░
                                                    #     
                                                                   
</pre>
---
## Prep
#### Kanban Board
As part of good DevOps practices, I roll a on-premises Kanban board to keep track of every task or feature there is to complete, for a simplified project as this one, I sectioned the board into three different lists: *To-do*, *In-Progress*, and *Done*.
| To-do | In-Progress | Done |
| --- | --- | --- |
|       |             |      |
|       |             |      |
|       |             |      |
|       |             |      |

#### GitHub
First and main thing around this project is to initialize the repository where our code is going to reside in, in this case my SCM of preference is GitHub and I'll be using the git CLI to manipulate it.

1. First we'll create an ssh key that will connect our terminal with our GitHub account.
2. We initialize our working directory with *git init*.
3. Then create a repository where all of our code is going to be hosted at and commit for the first time the *readme.md* file.

#### Venv
The project will consist of a simple Flask application in which we'll make use of the *flask* and *requests* dependencies, to isolate these from the whole system, we are going to utilize a virtual environment.

1. First, we install the *python3-venv* package where the *venv* module is located.
```bash
sudo apt install python3-venv -y 
```
2. Then, in the directory we want to work in, we initialize the virtual environment  
```bash
  python3 -m venv venv 
```
3. We then activate the virtual environment
```bash
  source /venv/bin/activate
```
4. Install the necessary packages
```bash
   pip install Flask requirements
```
5. Create the *requirements.txt* file
```bash
   pip freeze > requirements.txt
```



#### Docker
To easily manage both our frontend and our backend we are going to containerize our applications, this will allow us to seamlessly run it in any computer that has docker installed on it, plus will simplify the process of transporting the application to our production server.

1. In order to install docker engine, we'll follow the instructions written in the official [docs](https://docs.docker.com/engine/install/)
