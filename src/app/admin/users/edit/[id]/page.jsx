"use client"

import React, { useState, useEffect } from 'react'
import AdminNav from '../../../components/AdminNav'
import Footer from '../../../components/Footer'
import Container from '../../../components/Container'
import Link from 'next/link'

import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { useRouter } from 'next/navigation'

function AdminEditUserPage({ params }) {

    const { data: session } = useSession();
    if (!session) redirect(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/login`);
    if (!session?.user?.role === "admin") redirect(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/welcome`);

    const { id } = params;

    const [userOldData, setUserOldData] = useState([]);

    // New user data
    const [newName, setNewName] = useState("");
    const [newEmail, setNewEmail] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [newRole, setNewRole] = useState("");
    const [newBranch, setNewBranch] = useState("");

    const router = useRouter();

    const getUserById = async (id) => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/totalusers/${id}`, {
                method: "GET",
                cache: "no-store"
            })

            if (!res.ok) {
                throw new Error("Failed to fetch users");
            }

            const data = await res.json();
            setUserOldData(data.user);

        } catch(error) {
            console.log(error)
        }
    }

    useEffect(() => {
        getUserById(id);
    }, [])

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
             
            const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/totalusers/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    newName: newName || userOldData?.name,
                    newEmail: newEmail || userOldData?.email,
                    newPassword: newPassword || userOldData?.password,
                    newRole: newRole || userOldData?.role,
                    newBranch: newBranch || userOldData?.branch
                })
            })

            if (!res.ok) {
                throw new Error("Failed to update user");
            }

            router.refresh();
            router.push(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/admin/users`);

        } catch(error) {
            console.log(error);
        }
    }

  return (
    <Container>
        <AdminNav session={session} />
            <div className='flex-grow'>
                <div className='container mx-auto shadow-xl my-10 p-10 rounded-xl'>
                    <Link href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/admin/users`} className='bg-gray-500 inline-block text-white border py-2 px-3 rounded my-2'>Go back</Link>
                    <hr className='my-3' />
                    <h3 className='text-xl'>Admin Edit User Page</h3>
                    <form onSubmit={handleSubmit}>
                        <input type="text" className='w-[300px] block bg-gray-200 border py-2 px-3 rounded text-lg my-2' placeholder={userOldData?.name} onChange={(e) => setNewName(e.target.value)} value={newName} />
                        <input type="text" className='w-[300px] block bg-gray-200 border py-2 px-3 rounded text-lg my-2' placeholder={userOldData?.email} onChange={(e) => setNewEmail(e.target.value)} value={newEmail} />
                        <input type="password" className='w-[300px] block bg-gray-200 border py-2 px-3 rounded text-lg my-2' onChange={(e) => setNewPassword(e.target.value)} value={newPassword} />
                        <select
                          className='w-[300px] block bg-gray-200 border py-2 px-3 rounded text-lg my-2'
                          value={newRole || userOldData?.role}
                          onChange={(e) => setNewRole(e.target.value)}
                        >
                          <option value="user">staff</option>
                          <option value="admin">admin</option>
                        </select>
                        <input
                          type="text"
                          className='w-[300px] block bg-gray-200 border py-2 px-3 rounded text-lg my-2'
                          placeholder={userOldData?.branch || "Branch"}
                          onChange={(e) => setNewBranch(e.target.value)}
                          value={newBranch}
                        />
                        <button type='submit' name='update' className='bg-green-500 text-white border py-2 px-3 rounded text-lg my-2'>Update User</button>
                    </form>
                </div>
            </div>
        <Footer />
    </Container>
  )
}

export default AdminEditUserPage