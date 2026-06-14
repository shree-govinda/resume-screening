"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn, getRole } from "@/lib/auth";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return; }
    const role = getRole();
    if (role === "admin") router.push("/admin");
    else if (role === "recruiter") router.push("/jobs");
    else router.push("/feedback");
  }, [router]);
  return null;
}
