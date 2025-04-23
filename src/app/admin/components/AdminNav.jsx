import React from 'react'
import Link from 'next/link'
import Logo from '../../../../public/lmr.png'
import Image from 'next/image'
import { signOut } from 'next-auth/react'

function AdminNav({ session }) {
  return (
    <nav className='shadow-xl'>
        <div className='container mx-auto'>
            <div className='flex justify-between items-center p-4'>
                <div>
                    <Link href="/">
                        <Image src={Logo} width={100} height={100} alt="LMR Logo" />
                    </Link>
                </div>
                <ul className='flex'>
                    {!session ? (
                        <>
                            <li className='mx-3'><Link href="/login">Login</Link></li>
                            <li className='mx-3'><Link href="/register">Register</Link></li>
                        </>
                    ) : (
                        <li className="mx-3">
      <div className="flex items-center space-x-4">
        <span className="text-gray-800 text-lg">
          👋 สวัสดี Admin คุณ{session.user.name}
        </span>
        <div className="h-6 border-l border-gray-400" />
        <button
          onClick={() => signOut()}
          className="bg-red-500 text-white py-2 px-3 rounded-md text-lg hover:bg-red-600"
        >
          Logout
        </button>
      </div>
    </li>
                    )}
                </ul>
            </div>
        </div>
    </nav>
  )
}

export default AdminNav