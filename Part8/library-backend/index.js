const { ApolloServer, gql, UserInputError } = require('apollo-server');
const mongoose = require('mongoose');
const Author = require('./models/author');
const Book = require('./models/book');
const { v1: uuid } = require('uuid');

const MONGODB_URI = 'mongodb+srv://fullstack:2dNnLMji1haISUAV@cluster0.fsm0d.mongodb.net/librarygraphql?retryWrites=true';

console.log("Connecting to", MONGODB_URI);

mongoose.connect(
  MONGODB_URI, { 
    useNewUrlParser: true, useUnifiedTopology: true, 
    useFindAndModify: false, useCreateIndex: true }
).then(() => {
  console.log("connected to MongoDB")
}).catch((error) => {
  console.log("error connection to MongoDB:", error.message);
});

// let findAuthorWritten = (authorName) => {
//   let count = 0;
//   books.forEach((book) => book.author === authorName ? count++ : "" );
//   return count;
// }

let authors = [
  {
    name: 'Robert Martin',
    id: "afa51ab0-344d-11e9-a414-719c6709cf3e",
    born: 1952,
  },
  {
    name: 'Martin Fowler',
    id: "afa5b6f0-344d-11e9-a414-719c6709cf3e",
    born: 1963
  },
  {
    name: 'Fyodor Dostoevsky',
    id: "afa5b6f1-344d-11e9-a414-719c6709cf3e",
    born: 1821
  },
  { 
    name: 'Joshua Kerievsky', // birthyear not known
    id: "afa5b6f2-344d-11e9-a414-719c6709cf3e",
  },
  { 
    name: 'Sandi Metz', // birthyear not known
    id: "afa5b6f3-344d-11e9-a414-719c6709cf3e",
  },
]

let books = [
  {
    title: 'Clean Code',
    published: 2008,
    author: 'Robert Martin',
    genres: ['refactoring'],
    id: "afa5b6f4-344d-11e9-a414-719c6709cf3e",
  },
  {
    title: 'Agile software development',
    published: 2002,
    author: 'Robert Martin',
    genres: ['agile', 'patterns', 'design'],
    id: "afa5b6f5-344d-11e9-a414-719c6709cf3e",
  },
  {
    title: 'Refactoring, edition 2',
    published: 2018,
    author: 'Martin Fowler',
    genres: ['refactoring'],
    id: "afa5de00-344d-11e9-a414-719c6709cf3e",
  },
  {
    title: 'Refactoring to patterns',
    published: 2008,
    author: 'Joshua Kerievsky',
    genres: ['refactoring', 'patterns'],
    id: "afa5de01-344d-11e9-a414-719c6709cf3e",
  },  
  {
    title: 'Practical Object-Oriented Design, An Agile Primer Using Ruby',
    published: 2012,
    author: 'Sandi Metz',
    genres: ['refactoring', 'design'],
    id: "afa5de02-344d-11e9-a414-719c6709cf3e",
  },
  {
    title: 'Crime and punishment',
    published: 1866,
    author: 'Fyodor Dostoevsky',
    genres: ['classic', 'crime'],
    id: "afa5de03-344d-11e9-a414-719c6709cf3e",
  },
  {
    title: 'The Demon ',
    published: 1872,
    author: 'Fyodor Dostoevsky',
    genres: ['classic', 'revolution'],
    id: "afa5de04-344d-11e9-a414-719c6709cf3e",
  },
]

const typeDefs = gql`
  type Book {
    title: String!
    published: Int!
    author: Author!
    genres: [String!]!
    id: ID!
  }

  type Author {
    name: String!
    born: Int
    bookCount: Int!
    id: ID!
  }

  type Query {
    bookCount: Int!
    authorCount: Int!
    allBooks(
      author: String
      genre: String
    ): [Book!]!
    allAuthors: [Author!]!
  }

  type Mutation {
    addBook(
      title: String!
      published: Int!
      author: String!
      genres: [String!]!
    ): Book

    editAuthor(
      name: String!
      setBornTo: Int!
    ): Author
  }
`

const resolvers = {
  Query: {
    bookCount: () => Book.collection.countDocuments(),
    authorCount: () => Author.collection.countDocuments(),
    allBooks: async (root, args) => {
      let query = {};

      if (args.author) {
        const author = await Author.findOne({ name: args.author });
        if (!author) return [];

        query.author = author._id;
      }

      if (args.genre) query.genre = { $in: [author._id] };
      
      return Book.find(query).populate('author');
    },
    allAuthors: async (root, args) => {
      const countAuthor = await Book.aggregate([
          { $group: { _id: '$author', count: { $sum: 1 } } }
      ]).allowDiskUse(true);
      // console.log(countAuthor);

      const countAuthorMap = new Map(countAuthor.map((author) => 
        [author._id.toString(), author.count]
      ));
      // console.log(countAuthorMap);

      const authors = await Author.find({});

      for (let i = 0; i < authors.length; i++) {
        authors[i].bookCount = countAuthorMap.get(authors[i]._id.toString()) || 0;
      }
      return authors;
    }
  },

  Mutation: {
    addBook: async (root, args) => {
      if (!args.title) {
        throw new UserInputError('title must be specified or too short', {
          invalidArgs: args.title,
        });
      }

      if (args.published <= 0) {
        throw new UserInputError('published year must be specified', {
          invalidArgs: args.published,
        });
      }

      if (!args.author) {
        throw new UserInputError('author name must specified', {
          invalidArgs: args.author,
        });
      }

      console.log(args.genres.length);
      if (args.genres.length <= 0) {
        throw new UserInputError('at least one genre name must specified', {
          invalidArgs: args.genres,
        });
      }

      let author = await Author.findOne({ name: args.author });

      try {
        if (!author) {
          author = new Author({ name: args.author });
          await author.save();
        }
        let book = new Book({ ...args, author: author._id });
        await book.save();
        return book;
      } catch(e) {
        throw new UserInputError(e.message, {
          invalidArgs: args,
        });
      }
    },

    // For now limited to only edit the born year
    editAuthor: async (root, args) => {
      const author = await Author.findOne({ name:  args.name});
      if (!author) return null;

      try {
        author.born = args.setBornTo;
        await author.save()
      } catch(e) {
        throw new UserInputError(e.message, {
          invalidArgs: args,
        })
      }
      return author;
    },
  }
}

const server = new ApolloServer({
  typeDefs,
  resolvers,
})

server.listen().then(({ url }) => {
  console.log(`Server ready at ${url}`)
})