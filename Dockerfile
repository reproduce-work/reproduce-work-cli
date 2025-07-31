FROM node:18

RUN apt-get update && \
    apt-get install -y git

# Add the "docker" group and add the "node" user to it
RUN groupadd -g 999 docker && \
    usermod -aG docker node

# Download and install Docker CLI for arm64 directly
#RUN curl -fsSLo docker.tgz https://download.docker.com/linux/static/stable/aarch64/docker-20.10.8.tgz && \
#    tar --extract --file docker.tgz --strip-components 1 --directory /usr/local/bin/ docker/docker && \
#    rm docker.tgz && \
#    chmod +x /usr/local/bin/docker

RUN mkdir /home/node/app
RUN ln -s /home/node/app /app

# Set the working directory
WORKDIR /home/node

# Copy the current directory contents into the container
COPY . /home/node
RUN chown -R node:node /home/node && \
    find /home/node -type d -exec chmod 700 {} + && \
    find /home/node -type f -exec chmod 600 {} +
RUN chmod +x /home/node/build.sh

USER node

# Install any needed packages specified in package.json
RUN npm install
ENV PATH=/home/node/node_modules/.bin:$PATH

#RUN chmod +x /home/node/bin/reproduce-work
#RUN ln -s /home/node/bin/reproduce-work /home/node/bin/rw
ENV PATH=/home/node/bin:$PATH

RUN npm run build

# Set the working directory
WORKDIR /home/node/app


