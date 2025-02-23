#use the official node.js 18 image with apline linux as the base image

FROM node:18-apline  

WORKDIR /use/src/app

COPY package*.json ./

RUN npm ci --only=production

COPY . .

EXPOSE 3001

CMD [ "node","src/server.js" ]