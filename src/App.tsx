import { useConvexAuth } from 'convex/react';
import { SignIn, SignOut } from './Auth';
import './App.css';

function App() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading){
    return (
      <div>
        Loading...
      </div>
    )
  }
  return (
    <>
      {isAuthenticated ? <SignOut /> : <SignIn />}
    </>
  )
};

export default App
