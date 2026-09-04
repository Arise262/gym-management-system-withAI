'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ChangePassword } from '@/action/auth.action'

export default function Page() {
    const router = useRouter()
    const [state, formAction, pending] = useActionState(ChangePassword, null)

    useEffect(() => {
        if (state?.success) {
            toast.success('Password changed successfully')
            router.push('/member')
        }
    }, [state, router])

    return (
        <div className='p-4 max-w-xl mx-auto'>
            <Card>
                <CardHeader>
                    <CardTitle>Change password</CardTitle>
                </CardHeader>
                <CardContent>
                    <form action={formAction} className='flex flex-col gap-5'>
                        <div className='grid gap-3'>
                            <Label htmlFor='oldPassword'>
                                Old password <span className='text-destructive'>*</span>
                            </Label>
                            <Input
                                id='oldPassword'
                                name='oldPassword'
                                type='password'
                                autoComplete='current-password'
                                required
                                placeholder='Enter old password'
                            />
                        </div>

                        <div className='grid gap-3'>
                            <Label htmlFor='newPassword'>
                                New password <span className='text-destructive'>*</span>
                            </Label>
                            <Input
                                id='newPassword'
                                name='newPassword'
                                type='password'
                                autoComplete='new-password'
                                required
                                placeholder='At least 8 characters'
                            />
                        </div>

                        <div className='grid gap-3'>
                            <Label htmlFor='confirmPassword'>
                                Confirm password <span className='text-destructive'>*</span>
                            </Label>
                            <Input
                                id='confirmPassword'
                                name='confirmPassword'
                                type='password'
                                autoComplete='new-password'
                                required
                                placeholder='Re-enter new password'
                            />
                        </div>

                        {state && !state.success && (
                            <p role='alert' className='text-sm font-medium text-destructive'>
                                {state.error}
                            </p>
                        )}

                        <Button type='submit' disabled={pending}>
                            {pending ? 'Saving…' : 'Change password'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
