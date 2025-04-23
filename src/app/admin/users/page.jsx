"use client"

import React, { useState, useEffect } from 'react'
import AdminNav from '../components/AdminNav'
import Footer from '../components/Footer'
import SideNav from '../components/SideNav'
import Container from '../components/Container'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import DeleteBtn from './DeleteBtn'

function AdminUserManagePage() {

    const { data: session } = useSession();
    if (!session) redirect("/login");
    if (!session?.user?.role === "admin") redirect("/welcome");

    const [allUsersData, setAllUsersData] = useState([]);

    console.log("allUsersData: ", allUsersData)

    const getAllUsersData = async () => {
        try {

            const res = await fetch("/api/totalusers", {
                cache: "no-store"
            })

            if (!res.ok) {
                throw new Error("Failed to fetch user");
            }

            const data = await res.json();
            setAllUsersData(data.totalUsers);

        } catch(error) {
            console.log("Error loading users: ", error);
        }
    }

    useEffect(() => {
        getAllUsersData();
    }, [])

  return (
    <Container>
        <AdminNav session={session} />
            <div className='flex-grow'>
                <div className='container mx-auto'>
                    <div className='flex mt-10'>
                        <SideNav />
                        <div className='p-10'>
                            <h3 className='text-3xl mb-3'>ผู้ใช้งาน</h3>

                            <div className='shadow-lg overflow-x-auto'>
                                <table className='text-left rounded-md mt-3 table-fixed w-full'>
                                    <thead>
                                        <tr className='bg-gray-400'>
                                            <th className='p-5'>ชื่อพนักงาน</th>
                                            <th className='p-5'>Username</th>
                                            <th className='p-5'>Role</th>
                                            <th className='p-5'>สาขา</th>
                                            <th className='p-5'>ประเทศ</th>
                                            <th className='p-5'>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {allUsersData?.map(val => (
                                            <tr key={val._id}>
                                                <td className='p-5'>{val.name}</td>
                                                <td className='p-5'>{val.email}</td>
                                                <td className='p-5'>{val.role}</td>
                                                <td className='p-5'>{val.branch}</td>
                                                <td className='p-5'>{val.country}</td>
                                                <td className='p-5'>
                                                    <Link className='bg-gray-500 text-white border py-2 px-3 rounded text-lg my-2' href={`/admin/users/edit/${val._id}`}>Edit</Link>
                                                    <DeleteBtn id={val._id} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        <Footer />
    </Container>
  )
}

export default AdminUserManagePage