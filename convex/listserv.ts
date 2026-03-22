import React from "react";

export default function App() {
  //Example emails
  const emails = [
    "acsu-l@list.cornell.edu",
    "cs-l@cornell.edu",
    "startupclub@cornell.edu",
    "friend@gmail.com"
  ];
  //Will need to be modified depending on our database schema
  function detectListserv(emails) {
    const results = [];

    for (const email of emails) {
      const username = email.split("@")[0];

      if (username.includes("-l")) {
        results.push("LISTSERV");
      } else {
        results.push("NOT LISTSERV");
      }
    }

    return results;
  }

  const results = detectListserv(emails);

  return (
    <div>
      <h2>Email Classification</h2>
      {emails.map((email, index) => (
        <p key={index}>
          {email} → {results[index]}
        </p>
      ))}
    </div>
  );
}