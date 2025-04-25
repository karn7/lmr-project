"use client"

import React from 'react'
import Link from 'next/link'
import Logo from '../../../public/lmr.png'
import Image from 'next/image'
import { signOut } from 'next-auth/react'

function Navbar({ session }) {
  return (
    <nav className='shadow-xl'>
        <div className='container mx-auto'>
            <div className='flex justify-between items-center p-4'>
                <div>
                    <Link href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/`}>
                        <Image src={Logo} width={100} height={100} alt='LMR Logo' />
                    </Link>
                </div>
                <ul className='flex'>
                    {!session ? (
                        <>
                            <li className='mx-3'><Link href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/login`}>Login</Link></li>
                            <li className='mx-3'><Link href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/register`}>Register</Link></li>
                        </>
                    ) : (
                      <li className="mx-3">
                      <div className="flex items-center space-x-4">
                        <div className="flex flex-col">
                          <span className="text-gray-800 text-lg font-medium">👋 สวัสดี คุณ{session.user.name}</span>
                          <span className="text-gray-500 text-sm">สาขา : {session.user.branch}</span>
                        </div>
                        <div className="h-10 border-l border-gray-400" />
                        <button onClick={() => signOut()} className="bg-red-500 text-white py-2 px-3 rounded-md text-lg hover:bg-red-600">Logout</button>
                      </div>
                    </li>
                    )}
                </ul>
            </div>
        </div>
    </nav>
  )
}

export default Navbar