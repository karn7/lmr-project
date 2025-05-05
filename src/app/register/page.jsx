"use client"

import React, { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import Container from '../components/Container'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

function RegisterPage() {

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [role, setRole] = useState("");
    const [branch, setBranch] = useState("");
    const [country, setCountry] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const { data: session } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (session && session.user?.role !== "admin") {
            router.push(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/`);
        } else if (!session) {
            router.push(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/`);
        }
    }, [session]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (password != confirmPassword) {
            setError("Password do not match");
            return;
        }

        if (!name || !email || !password || !confirmPassword || !role || !branch || !country) {
            setError("Please complete all inputs");
            return;
        }

        try {

            const resUserExists = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/userExists`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email })
            })

            const { user } = await resUserExists.json();

            if (user) {
                setError("User already exists.");
                return;
            }

            const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/register`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name, email, password, role, country, branch
                })
            })

            if (res.ok) {
                const form = e.target;
                setError("");
                setSuccess("User registered successfully.");
                form.reset();
            } else {
                console.log("User registration failed.");
            }

        } catch (error) {
            console.log("Error during registration: ", error);
        }
    }

    return (
        <Container>
            <Navbar />
            <div className='flex-grow'>
                <div className='flex justify-center items-center'>
                    <div className='w-[400px] shadow-xl p-10 mt-5 rounded-xl'>
                        <h3 className='text-3xl'>Register</h3>
                        <hr className='my-3' />
                        <form onSubmit={handleSubmit}>

                            {error && (
                                <div className='bg-red-500 w-fit text-sm text-white py-1 px-3 rounded-md mt-2'>
                                    {error}
                                </div>
                            )}

                            {success && (
                                <div className='bg-green-500 w-fit text-sm text-white py-1 px-3 rounded-md mt-2'>
                                    {success}
                                </div>
                            )}

                            <input type="text" onChange={(e) => setName(e.target.value)} className='w-full bg-gray-200 border py-2 px-3 rounded text-lg my-2' placeholder='ชื่อพนักงาน' />
                            <input type="text" onChange={(e) => setEmail(e.target.value)} className='w-full bg-gray-200 border py-2 px-3 rounded text-lg my-2' placeholder='Username' />
                            <input type="password" onChange={(e) => setPassword(e.target.value)} className='w-full bg-gray-200 border py-2 px-3 rounded text-lg my-2' placeholder='Password' />
                            <input type="password" onChange={(e) => setConfirmPassword(e.target.value)} className='w-full bg-gray-200 border py-2 px-3 rounded text-lg my-2' placeholder='Confirm Password' />
                            <select onChange={(e) => setRole(e.target.value)} className='w-full bg-gray-200 border py-2 px-3 rounded text-lg my-2'> <option value="staff">Staff</option> <option value="manager">Manager</option>  <option value="admin">Admin</option> </select>
                            <select onChange={(e) => setCountry(e.target.value)} className='w-full bg-gray-200 border py-2 px-3 rounded text-lg my-2'>
                                <option value="">Select Country</option>
                                <option value="Thai">Thai</option>
                                <option value="Laos">Laos</option>
                            </select>
                            <input type="text" onChange={(e) => setBranch(e.target.value)} className='w-full bg-gray-200 border py-2 px-3 rounded text-lg my-2' placeholder='สาขา' />
                            <button className='bg-green-500 text-white border py-2 px-3 rounded text-lg my-2' type='submit'>Sign Up</button>
                        </form>
                    </div>
                </div>
            </div>
            <Footer />
        </Container>
    )
}

export default RegisterPage