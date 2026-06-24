"use client";



import { useEffect, useState } from "react";

import { IndexedDBStorage } from "@doc-solid/storage";

import { useAuth } from "@/components/AuthProvider";



export function useDocumentStats() {

  const { session } = useAuth();

  const [count, setCount] = useState(0);

  const [loading, setLoading] = useState(true);



  useEffect(() => {

    const storage = new IndexedDBStorage();

    storage.getDocumentsForUser(session?.userId ?? null).then((docs) => {

      setCount(docs.length);

      setLoading(false);

    });

  }, [session?.userId]);



  return { count, loading };

}



export function getAccountAge(createdAt: string): string {

  const created = new Date(createdAt);

  const now = new Date();

  const days = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));

  if (days === 0) return "Joined today";

  if (days === 1) return "Joined yesterday";

  if (days < 30) return `Member for ${days} days`;

  if (days < 365) return `Member for ${Math.floor(days / 30)} months`;

  return `Member for ${Math.floor(days / 365)} year(s)`;

}


