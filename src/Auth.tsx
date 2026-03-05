import { useAuthActions } from "@convex-dev/auth/react";
 
export function SignIn() {
  const { signIn } = useAuthActions();
  return (
    <button onClick={() => {
        console.log("Signing in...");
        void signIn("google").then(() => console.log("Signed in!"));
    }}>Sign in with Google</button>
  );
}

export function SignOut() {
  const { signOut } = useAuthActions();
  return (
    <button onClick={() => {
        console.log("Signing out...");
        void signOut().then(() => console.log("Signed out!"));
    }}>Sign Out</button>
  );
}