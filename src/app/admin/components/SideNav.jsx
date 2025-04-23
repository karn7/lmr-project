import React from 'react'
import Link from 'next/link'

function SideNav() {
  return (
    <nav className='shadow-lg p-10 rounded-lg'>
        <ul>
            <li><Link className='block my-3 p-3 rounded-lg' href="/admin">Dashboard</Link></li>
            <li><Link className='block my-3 p-3 rounded-lg' href="/admin/users">Users</Link></li>
            <li><Link className='block my-3 p-3 rounded-lg' href="/admin/rateadmin">Rate</Link></li>
            <li><Link className='block my-3 p-3 rounded-lg' href="/admin/report">Report</Link></li>
            <li><Link className='block my-3 p-3 rounded-lg' href="/admin/cash">Cash</Link></li>
        </ul>
    </nav>
  )
}

export default SideNav