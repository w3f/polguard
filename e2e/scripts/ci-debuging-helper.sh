
# execute this script in a circleCI host when connecting via SSH to have kubectl available
# helpful for debugging quickly

cd $HOME
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x ./kubectl
alias kubectl=$HOME/kubectl
alias k=$HOME/kubectl
kubectl config set-context --current --namespace=e2e

