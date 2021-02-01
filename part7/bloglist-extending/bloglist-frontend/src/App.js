import React, { useState, useEffect } from 'react'
import Blog from './components/Blog'
import Notification from './components/Notification';
import blogService from './services/blogs'
import loginService from './services/login'
import Togglable from './components/Togglable'
import AddBlogForm from './components/AddBlogForm'
import { useDispatch } from 'react-redux';
import { setNotification } from './reducers/notificationReducer';
import LoginForm from './components/LoginForm';

const sortByLikes = (blogs) => blogs.sort((a, b) => b.likes - a.likes)

const App = () => {
  const [blogs, setBlogs] = useState([]);
  const [user, setUser] = useState(null);

  const dispatch = useDispatch(); // ! DELETE/MOVE LATER
  
  useEffect(() => {
    blogService.getAll().then(blogs =>
      setBlogs(sortByLikes(blogs))
    )
  }, [])

  useEffect(() => {
    const loggedUserJSON = window.localStorage.getItem('loggedBlogAppUser')
    if (loggedUserJSON) {
      const user = JSON.parse(loggedUserJSON)
      blogService.setToken(user.token)
      setUser(user)
    }
  }, [])

  const handleLogin = async ({ username, password }) => {
    try {
      const user = await loginService.login({
        username, password,
      })

      window.localStorage.setItem(
        'loggedBlogAppUser', JSON.stringify(user)
      );

      // console.log(user);
      blogService.setToken(user.token)
      dispatch(setNotification(`Successfully logged in as ${user.name}`, 'success', 5));
      setUser(user);
    } catch (exception) {
      dispatch(setNotification('Wrong username or password', 'error', 5));
    }
  }

  const handleLogout = async () => {
    // event.preventDefault();
    window.localStorage.removeItem('loggedBlogAppUser')
    blogService.setToken(null)
    setUser(null)
  }

  const handleAddBlog = async ({ title, author, url }) => {
    try {
      const blog = await blogService.createBlog({
        title, author, url,
      })
      dispatch(
        setNotification(
          `a new blog ${blog.title} by ${blog.author} added`, 'success', 5)
      );

      // Update state of App component
      setBlogs(sortByLikes(blogs.concat(blog)))
    } catch (exception) {
      console.log(exception)
      dispatch(setNotification(`${exception}`, 'error', 5)); //! WATCH
    }
  }

  const handleLike = async (blog) => {
    const blogId = blog.id
    const updatedBlog = {
      user: blog.user.id,
      likes: blog.likes + 1,
      author: blog.author,
      title: blog.title,
      url: blog.url,
    }
    try {
      const updated = await blogService.updateBlog(blogId, updatedBlog)
      // Update state of App component
      setBlogs(sortByLikes(blogs.map((blog) => blog.id !== blogId ? blog : updated)))
    } catch(exception) {
      console.log(exception)
      dispatch(setNotification(`${exception}`, 'error', 5)); //! WATCH
    }
  }

  const handleDelete = async (blog) => {
    if (!window.confirm(`Remove blog ${blog.title} by ${blog.author}`)) {
      return
    }
    const id = blog.id

    try {
      await blogService.deleteBlog(id)
      dispatch(setNotification(`Deleted ${blog.title} by ${blog.author}`, 'success', 5)); //! WATCH
      
      // Update state of App component
      setBlogs(sortByLikes(blogs.filter((blog) => blog.id !== id)))
    } catch (exception) {
      console.log(exception)
    }
  }

  const addBlogForm = () => (
    <Togglable buttonLabel="new blog">
      <AddBlogForm createBlog={handleAddBlog} />
    </Togglable>
  )

  // console.log(user);

  // If user is not logged in
  if (user === null) {
    // loginForm()
    return (
      <LoginForm onLogin={handleLogin} />
    )
  }

  // console.log(blogs);

  return (
    <div id="maincontent">
      <div className="header">
        <h2>blogs</h2>

        <Notification />

        {user.name} logged in
        <button onClick={handleLogout}>logout</button>
      </div>

      {addBlogForm()}

      {blogs.map((blog) =>
        <Blog
          key={blog.id}
          blog={blog}
          addLike={() => handleLike(blog)}
          onDelete={
            blog.user && blog.user.username === user.username ?
              () => handleDelete(blog) :
              null
          }
        />
      )}
    </div>
  )
}

export default App