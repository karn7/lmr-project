"use client"

import React, { useState } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import Link from 'next/link'
import Container from '../components/Container'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { useRouter } from 'next/navigation'
import UserSideNav from '../admin/components/SideNav'

function CreatePage() {
  
    const { data: session } = useSession();
    if (!session) redirect(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/login`);

    const userEmail = session?.user?.email;

    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [buy, setBuy] = useState("");
    const [sell, setSell] = useState("");
    const [buylaos, setBuylaos] = useState("");
    const [selllaos, setSelllaos] = useState("");

    const router = useRouter();

    console.log(title, content, buy, sell, buylaos, selllaos);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!title) {
            alert("Please complete the currency name.");
            return;
        }

        const finalContent = content.trim() === "" ? "-" : content;
        const finalBuy = buy.trim() === "" ? "0" : buy;
        const finalSell = sell.trim() === "" ? "0" : sell;
        const finalBuylaos = buylaos.trim() === "" ? "0" : buylaos;
        const finalSelllaos = selllaos.trim() === "" ? "0" : selllaos;

        try {

            const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/posts`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    title,
                    content: finalContent,
                    buy: Number(finalBuy),
                    sell: Number(finalSell),
                    buylaos: Number(finalBuylaos),
                    selllaos: Number(finalSelllaos)
                })
            })

            if (res.ok) {
                router.push(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/admin/rateadmin`);
            } else {
                throw new Error("Failed to create a post");
            }

        } catch(error) {
            console.log(error)
        }
    }

    return (
    <Container>
        <Navbar session={session} />
            <div className='flex-grow'>
            <div className='container mx-auto my-10 px-5'>
                <div className='flex gap-8 items-start'>
                        <UserSideNav />
                    <div className='w-3/4 bg-white shadow-md rounded-lg p-5'>
                        <Link href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/admin/rateadmin`} className='bg-gray-500 inline-block text-white border py-2 px-3 rounded my-2'>Go back</Link>
                        <hr className='my-3' />
                        <h3 className='text-xl'>Create Rate</h3>
                        <form onSubmit={handleSubmit}>
                            <input type="text" onChange={(e) => setTitle(e.target.value)} className='w-full block bg-gray-200 border py-2 px-3 rounded text-lg my-2' placeholder='สกุลเงิน' />
                            <input type="text" onChange={(e) => setContent(e.target.value)} className='w-full block bg-gray-200 border py-2 px-3 rounded text-lg my-2' placeholder='หน่วยเงินตรา' />
                            <input type="text" onChange={(e) => setBuy(e.target.value)} className='w-full block bg-gray-200 border py-2 px-3 rounded text-lg my-2' placeholder='เรทซื้อ' />
                            <input type="text" onChange={(e) => setSell(e.target.value)} className='w-full block bg-gray-200 border py-2 px-3 rounded text-lg my-2' placeholder='เรทขาย' />
                            <input type="text" onChange={(e) => setBuylaos(e.target.value)} className='w-full block bg-gray-200 border py-2 px-3 rounded text-lg my-2' placeholder='เรทซื้อ (ลาว)' />
                            <input type="text" onChange={(e) => setSelllaos(e.target.value)} className='w-full block bg-gray-200 border py-2 px-3 rounded text-lg my-2' placeholder='เรทขาย (ลาว)' />
                            <button type='submit' name='create' className='bg-green-500 text-white border py-2 px-3 rounded text-lg my-2'>บันทึกข้อมูล</button>
                        </form>
                    </div>
                </div>
            </div>
            </div>
        <Footer />
    </Container>
  )
}

export default CreatePage