"use client"

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { useRouter } from 'next/navigation'
import Container from "../../components/Container";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";


function EditPage({ params }) {

    const { data: session } = useSession();
    if (!session) redirect(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/login`);

    const { id } = params;
    console.log(id)

    const [postData, setPostData] = useState(null);

    // New data of post
    const [newTitle, setNewTitle] = useState("");
    const [newContent, setNewContent] = useState("");
    const [newBuyLaos, setNewBuyLaos] = useState("");
    const [newSellLaos, setNewSellLaos] = useState("");

    const router = useRouter();

    const getPostById = async (id) => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/posts/${id}`, {
                method: "GET",
                cache: "no-store"
            })

            if (!res.ok) {
                throw new Error("Failed to fetch post");
            }

            const data = await res.json();
            console.log("Edit post: ", data);
            setPostData(data.post);

        } catch(error) {
            console.log(error);
        }
    }

    useEffect(() => {
        getPostById(id)
    }, [])

    const handleSubmit = async (e) => {
        e.preventDefault();
      
        // ใช้ค่าจาก postData ถ้า input ยังว่างอยู่
        const updatedTitle = postData?.title;
        const updatedContent = postData?.content;
        const updatedBuyLaos = newBuyLaos || postData?.buylaos;
        const updatedSellLaos = newSellLaos || postData?.selllaos;
      
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/posts/${id}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              newTitle: updatedTitle,
              newContent: updatedContent,
              newBuyLaos: updatedBuyLaos,
              newSellLaos: updatedSellLaos
            })
          });
      
          if (!res.ok) {
            throw new Error("Failed to update post");
          }
      
          router.refresh();
          router.push(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/laos/rate`);
      
        } catch (error) {
          console.log(error);
        }
      };

  if (!postData) return <p className="p-5">กำลังโหลดข้อมูล...</p>;
  return (
    <Container>
        <Navbar />
            <div className='flex-grow'>
                <div className='container mx-auto shadow-xl my-10 p-10 rounded-xl'>
                    <Link href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/laos/rate`} className='bg-gray-500 inline-block text-white border py-2 px-3 rounded my-2'>กลับ</Link>
                    <hr className='my-3' />
                    <h3 className='text-xl'>แก้ไขอัตราแลกเปลี่ยน</h3>
                    <form onSubmit={handleSubmit}>
                        <input type="text" disabled className='w-[300px] block bg-gray-200 border py-2 px-3 rounded text-lg my-2' 
                            placeholder={postData?.title} onChange={(e) => setNewTitle(e.target.value)} value={newTitle} />
                        <input type="text" disabled className='w-[300px] block bg-gray-200 border py-2 px-3 rounded text-lg my-2' 
                            placeholder={postData?.content} onChange={(e) => setNewContent(e.target.value)} value={newContent} />
                        <input type="text" className='w-[300px] block bg-gray-200 border py-2 px-3 rounded text-lg my-2' 
                            placeholder={postData?.buylaos} onChange={(e) => setNewBuyLaos(e.target.value)} value={newBuyLaos} />
                        <input type="text" className='w-[300px] block bg-gray-200 border py-2 px-3 rounded text-lg my-2' 
                            placeholder={postData?.selllaos} onChange={(e) => setNewSellLaos(e.target.value)} value={newSellLaos} />        
                        <button type='submit' name='update' className='bg-green-500 text-white border py-2 px-3 rounded text-lg my-2'>บันทึกข้อมูล</button>
                    </form>
                </div>
            </div>
        <Footer />
    </Container>
  )
}

export default EditPage