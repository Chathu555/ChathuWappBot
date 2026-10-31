FROM node:18-alpine

# මෙන්න මේ විදිහට git ඉන්ස්ටෝල් කරගැනීමට අත්‍යවශ්‍ය කෝඩ් එක එකතු කර තිබිය යුතුය

RUN apk add --no-cache python3 make g++ git

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
 
