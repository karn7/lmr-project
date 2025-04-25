"use client"

import React, { useState, useEffect } from 'react'
import Navbar from '../../components/Navbar'
import Footer from '../../components/Footer'
import Link from 'next/link'
import Container from '../../components/Container'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { useRouter } from 'next/navigation'

function EditPage({ params }) {

    const { data: session } = useSession();
    if (!session) redirect(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/login`);

    const { id } = params;
    console.log(id)

    const [postData, setPostData] = useState("");

    // New data of post
    const [newTitle, setNewTitle] = useState("");
    const [newContent, setNewContent] = useState("");
    const [newBuy, setNewBuy] = useState("");
    const [newSell, setNewSell] = useState("");

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
            setPostData(data);

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
        const updatedTitle = newTitle || postData.post?.title;
        const updatedContent = newContent || postData.post?.content;
        const updatedBuy = newBuy || postData.post?.buy;
        const updatedSell = newSell || postData.post?.sell;
      
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/posts/${id}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              newTitle: updatedTitle,
              newContent: updatedContent,
              newBuy: updatedBuy,
              newSell: updatedSell
            })
          });
      
          if (!res.ok) {
            throw new Error("Failed to update post");
          }
      
          router.refresh();
          router.push(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/Rate-Thai`);
      
        } catch (error) {
          console.log(error);
        }
      };

  return (
    <Container>
        <Navbar />
            <div className='flex-grow'>
                <div className='container mx-auto shadow-xl my-10 p-10 rounded-xl'>
                    <Link href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/Rate-Thai`} className='bg-gray-500 inline-block text-white border py-2 px-3 rounded my-2'>กลับ</Link>
                    <hr className='my-3' />
                    <h3 className='text-xl'>แก้ไขอัตราแลกเปลี่ยน</h3>
                    <form onSubmit={handleSubmit}>
                        <input type="text" className='w-[300px] block bg-gray-200 border py-2 px-3 rounded text-lg my-2' 
                            placeholder={postData.post?.title} onChange={(e) => setNewTitle(e.target.value)} value={newTitle} />
                        <input type="text" className='w-[300px] block bg-gray-200 border py-2 px-3 rounded text-lg my-2' 
                            placeholder={postData.post?.content} onChange={(e) => setNewContent(e.target.value)} value={newContent} />
                        <input type="text" className='w-[300px] block bg-gray-200 border py-2 px-3 rounded text-lg my-2' 
                            placeholder={postData.post?.buy} onChange={(e) => setNewBuy(e.target.value)} value={newBuy} />
                        <input type="text" className='w-[300px] block bg-gray-200 border py-2 px-3 rounded text-lg my-2' 
                            placeholder={postData.post?.sell} onChange={(e) => setNewSell(e.target.value)} value={newSell} />        
                        <button type='submit' name='update' className='bg-green-500 text-white border py-2 px-3 rounded text-lg my-2'>บันทึกข้อมูล</button>
                    </form>
                </div>
            </div>
        <Footer />
    </Container>
  )
}

export default EditPage