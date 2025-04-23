"use client"
import Image from "next/image";
import React, { useState } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import Container from '../components/Container'
import Link from 'next/link'
import Vercel from "../../../public/lmr.png";
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

function LoginPage() {

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const router = useRouter();

    const { data: session } = useSession();
    if (session) router.replace("/")

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {

            const res = await signIn("credentials", {
                email, password, redirect: false
            })

            if (res.error) {
                setError("Invalid Credentials");
                return;
            }

            router.replace("/");

        } catch(error) {
            console.log(error);
        }
    }


  return (
    <Container>
            <div className='flex-grow'>
                <div className='flex justify-center items-center'>
                    <div className='w-[400px] shadow-xl p-10 mt-5 rounded-xl'>
                    <div className="flex justify-center my-10"><Image src={Vercel} width={300} height={0} alt="LMR logo" /></div>
                        <h3 className='text-3xl'>Login</h3>
                        <hr className='my-3' />
                        <form onSubmit={handleSubmit}>

                            {error && (
                                <div className='bg-red-500 w-fit text-sm text-white py-1 px-3 rounded-md mt-2'>
                                    {error}
                                </div>
                            )}
                            
                            <input type="text" onChange={(e) => setEmail(e.target.value)} className='w-full bg-gray-200 border py-2 px-3 rounded text-lg my-2' placeholder='Username' />
                            <input type="password" onChange={(e) => setPassword(e.target.value)} className='w-full bg-gray-200 border py-2 px-3 rounded text-lg my-2' placeholder='Password' />
                            <button className='bg-orange-500 text-white border py-2 px-3 rounded text-lg my-2' type='submit'>Sign In</button>
                        </form>
                    </div>
                </div>
            </div>
    </Container>
  )
}

export default LoginPage