"use client";

import { useEffect } from "react";

export default function ViewCounter({ id }: { id: string }) {
  useEffect(() => {
    // We send a POST request to our API route as soon as the page loads
    fetch(`/api/view/${id}`, { 
      method: "POST",
    }).catch((err) => console.error("Error updating views:", err));
  }, [id]);

  return null; // This component renders nothing
}