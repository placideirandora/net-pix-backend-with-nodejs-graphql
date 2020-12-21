const { ApolloServer, AuthenticationError } = require('apollo-server');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const path = require('path');
const User = require('./models/User');
const Post = require('./models/Post');
const resolvers = require('./graphql/resolvers');

// Read the GraphQL file and assign the defined types
const filePath = path.join(__dirname, 'graphql/typeDefs.gql');
const typeDefs = fs.readFileSync(filePath, 'utf-8');

// Configure environment variables
dotenv.config({ path: 'variables.env' });

// Database connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true
  })
  .then(() => {
    console.log('Database Connected');
  })
  .catch(err => {
    console.error('Database Not Connected Due To: ', err);
  });

// Token verification
const getUser = async token => {
  if (token) {
    try {
      return await jwt.verify(token.slice(7), process.env.SECRET);
    } catch (error) {
      throw new AuthenticationError('Your session has expired. Please, sign in again.');
    }
  }
};

// Initialize the Apollo Server
const server = new ApolloServer({
  typeDefs,
  resolvers,
  formatError: error => ({
    name: error.name,
    message: error.message
  }),
  context: async ({ req }) => {
    const token = req.headers.authorization;
    return { User, Post, currentUser: await getUser(token) };
  }
});

// Start the server
server.listen(4000).then(({ url }) => {
  console.log(`Server listening on: ${url}`);
});
