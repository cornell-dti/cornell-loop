import React from "react";

export default function App() {
//Example profile
  const userProfile = {
    major: "CS",
    interests: ["AI", "Startups", "Robotics"],
    tags: ["machine learning", "entrepreneurship"]
  };
  //Example events for different listservs.
  const events = [
    {
      id: 1,
      title: "Intro to AI Workshop",
      majorTags: ["CS"],
      interestTags: ["AI"],
      descriptionTags: ["machine learning"]
    },
    {
      id: 2,
      title: "Finance Networking Night",
      majorTags: ["Econ"],
      interestTags: ["Finance"],
      descriptionTags: ["investment banking"]
    },
    {
      id: 3,
      title: "Startup Hackathon",
      majorTags: ["CS", "Business"],
      interestTags: ["Startups"],
      descriptionTags: ["entrepreneurship"]
    }
  ];

  //Reccomendation algorithm will me fine tuned to match database schema decisions.
  function recommendEvents(user, events) {
    return events
      .map(event => {
        let score = 0;

        if (event.majorTags.includes(user.major)) score += 3;

        const interestMatches = event.interestTags.filter(tag =>
          user.interests.includes(tag)
        ).length;

        const tagMatches = event.descriptionTags.filter(tag =>
          user.tags.includes(tag)
        ).length;

        score += interestMatches * 2;
        score += tagMatches * 2;

        return { ...event, score };
      })
      .filter(event => event.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  const recommended = recommendEvents(userProfile, events);

  return (
    <div style={{ padding: "20px" }}>
      <h2>Recommended Events</h2>

      {recommended.map(event => (
        <div key={event.id} style={{ marginBottom: "10px" }}>
          <strong>{event.title}</strong>
          <p>Score: {event.score}</p>
        </div>
      ))}
    </div>
  );
}