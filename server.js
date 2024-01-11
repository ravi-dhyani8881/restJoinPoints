
const express = require('express');
const { graphqlHTTP } = require('express-graphql');
const SolrNode = require('solr-node');
const voyagerMiddleware = require('graphql-voyager/middleware');

const app = express();


// Solr setup
const solrContent = new SolrNode({
  host: 'localhost',
  port: '8983',
  core: 'content',
  protocol: 'http',
});

const solrApiKey = new SolrNode({
  host: 'localhost',
  port: '8983',
  core: 'apiKey',
  protocol: 'http',
});

// GraphQL schema
const { buildSchema } = require('graphql');
const schema = buildSchema(`
  type Query {
    search(query: String!): [SolrResult]
  }

  type SolrResult {
    ID: String
    contentDesc: String
    name_s: String
    apiKeyData: [ApiKey]
  }
  
  type ApiKey {
    userId: String
    apiKey: String
    status: String
    addedDate: String
    lastUpdate: String
  }
`);

// GraphQL resolver
const root = {
  search: async ({ query }) => {
    try {
      // Query the 'content' core
      const contentQuery = solrContent.query().q(query);

      console.log('>>>>>>>>>>>>>', query);
      const contentResult = await solrContent.search(contentQuery);

      // Query the 'contact' core
      const contactQuery = solrApiKey.query().q(query);
      const contactResult = await solrApiKey.search(contactQuery);

      // Combine or process the results as needed
      const combinedResults = [
        ...contentResult.response.docs,
        ...contactResult.response.docs
      
      ];

      // For each result, add a new property 'apiKeyData' with the apiKey query
      const resultsWithApiKeyData = await Promise.all(
        combinedResults.map(async (result) => {
          const apiKeyQuery = solrApiKey.query().q(`userId:${result.ID}`);
          const apiKeyResult = await solrApiKey.search(apiKeyQuery);
          const apiKeyData = apiKeyResult.response.docs.map(apiKey => ({
            userId: apiKey.userId,
            apiKey: apiKey.apiKey,
            status: apiKey.status,
            addedDate: apiKey.addedDate,
            lastUpdate: apiKey.lastUpdate,
          }));
          
          // Add the apiKeyData to the result
          return { ...result, apiKeyData };
        })
      );

      console.log('combinedResults:', resultsWithApiKeyData);

      return resultsWithApiKeyData;
    } catch (error) {
      console.error('Error executing Solr query:', error);
      throw new Error('Failed to execute Solr query');
    }
  },
};

// GraphQL endpoint
app.use(
  '/graphql',
  graphqlHTTP({
    schema,
    rootValue: root,
    graphiql: true, // Enable GraphiQL for testing
  })
);



const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/graphql`);
});
