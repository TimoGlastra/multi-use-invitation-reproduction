# Multi Use Invitation Reproduction

## Running

> Note: if you're on an ARM mac, run `docker build -t multi-use-invitation-demo -f Dockerfile.arm .` as the build step.

1. Git clone this repo
2. Create a class access token (needed to pull the `ghcr.io` image that contains libindy builds for ARM + x86)
   1. https://github.com/settings/tokens
   2. Give it the `read:packages` scope
3. Login to the docker registry with the token
   1. `export CR_PAT=<your token>`
   2. `echo $CR_PAT | docker login ghcr.io -u <your username> --password-stdin`
4. `docker build -t multi-use-invitation-demo .`
5. `docker run -it --rm multi-use-invitation-demo`
6. Scan the QR code, accept the offered credential, and see it get stuck. If you look at the logs of the docker container. You can see it throws an error related to `~service` decorator. This is because we can't find the connection associated with the credential request
