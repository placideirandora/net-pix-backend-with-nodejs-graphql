const bcrypt = require('bcryptjs');

const createToken = require('../helpers/generateToken');

module.exports = {
  Query: {
    getCurrentUser: async (_, args, { User, currentUser: { username } }) => {
      if (!username) {
        return null;
      }

      const user = await User.findOne({ username }).populate({
        path: 'favorites',
        model: 'Post',
      });

      return user;
    },
    getUserPosts: async (_, { userId }, { Post }) => {
      const posts = await Post.find({ createdBy: userId });

      return posts;
    },
    getPosts: async (_, args, { Post }) => {
      const posts = await Post.find({}).sort({ createdDate: 'desc' }).populate({
        path: 'createdBy',
        model: 'User',
      });

      return posts;
    },
    getPost: async (_, { postId }, { Post }) => {
      const post = await Post.findOne({ _id: postId }).populate({
        path: 'messages.messageUser',
        model: 'User',
      });

      return post;
    },
    searchPosts: async (_, { searchTerm }, { Post }) => {
      if (searchTerm) {
        const searchResults = await Post.find(
          // Perform Text Search for Search Value of Search Term
          {
            $text: { $search: searchTerm },
          },
          // Assign Search Term a Text Score to Provide Best Match
          {
            score: { $meta: 'textScore' },
          }
          // Sort Results According to the Text Score and Likes in Descending Order
        )
          .sort({ score: { $meta: 'textScore' }, likes: 'desc' })
          .limit(5);

        return searchResults;
      }
    },
    infiniteScrollPosts: async (_, { pageNum, pageSize }, { Post }) => {
      let posts;

      if (pageNum === 1) {
        posts = await Post.find({})
          .sort({ createdDate: 'desc' })
          .populate({
            path: 'createdBy',
            model: 'User',
          })
          .limit(pageSize);
      } else {
        const skips = pageSize * (pageNum - 1);

        posts = await Post.find({})
          .sort({ createdDate: 'desc' })
          .populate({
            path: 'createdBy',
            model: 'User',
          })
          .skip(skips)
          .limit(pageSize);
      }

      const totalDocs = await Post.countDocuments();
      const hasMore = totalDocs > pageSize * pageNum;

      return {
        posts,
        hasMore,
      };
    },
  },
  Mutation: {
    registerUser: async (_, { username, email, password }, { User }) => {
      const emailTaken = await User.findOne({ email });
      const usernameTaken = await User.findOne({ username });

      if (emailTaken) {
        throw new Error(
          `Email - ${emailTaken.email} - already taken. Please, choose another.`
        );
      }

      if (usernameTaken) {
        throw new Error(
          `Username - ${usernameTaken.username} - already taken. Please, choose another.`
        );
      }

      const newUser = await new User({ username, email, password }).save();

      return {
        token: createToken(newUser, process.env.SECRET, '1d'),
        userId: user._id,
      };
    },
    loginUser: async (_, { username, password }, { User }) => {
      const user = await User.findOne({ username });
      const message = 'Incorrect username or password.';

      if (!user) {
        throw new Error(message);
      }

      const isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {
        throw new Error(message);
      }

      return {
        token: createToken(user, process.env.SECRET, '1d'),
        userId: user._id,
      };
    },
    addPost: async (
      _,
      { title, imageUrl, categories, description, creatorId },
      { Post }
    ) => {
      const newPost = await new Post({
        title,
        imageUrl,
        categories,
        description,
        createdBy: creatorId,
      }).save();

      return newPost;
    },
    addPostComment: async (_, { commentBody, postId, userId }, { Post }) => {
      const newComment = {
        messageBody: commentBody,
        messageUser: userId,
      };

      const post = await Post.findOneAndUpdate(
        { _id: postId },
        { $push: { messages: { $each: [newComment], $position: 0 } } },
        { new: true }
      ).populate({
        path: 'messages.messageUser',
        model: 'User',
      });

      return post.messages[0];
    },
    likePost: async (_, { postId, username }, { Post, User }) => {
      const post = await Post.findOneAndUpdate(
        { _id: postId },
        { $inc: { likes: 1 } },
        { new: true }
      );

      const user = await User.findOneAndUpdate(
        { username },
        { $addToSet: { favorites: postId } },
        { new: true }
      ).populate({
        path: 'favorites',
        model: 'Post',
      });

      return { likes: post.likes, favorites: user.favorites };
    },
    unlikePost: async (_, { postId, username }, { Post, User }) => {
      const post = await Post.findOneAndUpdate(
        { _id: postId },
        { $inc: { likes: -1 } },
        { new: true }
      );

      const user = await User.findOneAndUpdate(
        { username },
        { $pull: { favorites: postId } },
        { new: true }
      ).populate({
        path: 'favorites',
        model: 'Post',
      });

      return { likes: post.likes, favorites: user.favorites };
    },
  },
};
