import { ChangePasswordForm } from '@/components/change-password-form'

export const metadata = { title: 'Change password' }

export default function Page() {
    return <ChangePasswordForm homeHref='/trainer' />
}
