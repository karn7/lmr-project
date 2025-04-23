"use client"

import React from 'react'

function DeleteBtn({ id }) {

    const handleDelete = async () => {
        const confirmed = confirm("Are you sure?");

        if (confirmed) {
            const res = await fetch(`/api/posts?id=${id}`, {
                method: "DELETE"
            })

            if (res.ok) {
                window.location.reload();
            } 
        }
    }

  return (
    <a onClick={handleDelete} className='bg-red-500 text-white border px-2 py-1 rounded-md text-xs my-2 cursor-pointer'>
        Delete
    </a>
  )
}

export default DeleteBtn