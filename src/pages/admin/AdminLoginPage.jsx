import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../../context/adminAuthContext'
import { useAsyncAction } from '../../hooks/useAsyncData'
import { adminLoginSchema, validateSchema } from '../../lib/validation'
import { Button } from '../../components/ui/Button'
import { GlassCard } from '../../components/ui/Card'
import { TextInput } from '../../components/ui/Field'
import { Icon } from '../../components/ui/Icon'

export function AdminLoginPage() {
  const { login, isAuthenticated, isChecking } = useAdminAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [values, setValues] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})

  const submission = useAsyncAction(async (credentials) => {
    await login(credentials)
    navigate(location.state?.from ?? '/admin', { replace: true })
  })

  if (!isChecking && isAuthenticated) return <Navigate to="/admin" replace />

  const handleSubmit = (event) => {
    event.preventDefault()
    const { valid, errors: validationErrors } = validateSchema(values, adminLoginSchema)
    setErrors(validationErrors)
    if (valid) submission.run(values)
  }

  const setField = (field) => (event) => {
    setValues((previous) => ({ ...previous, [field]: event.target.value }))
    setErrors((previous) => ({ ...previous, [field]: undefined }))
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <GlassCard className="w-full max-w-md p-10">
        <div className="mb-10 text-center">
          <p className="font-headline text-headline-lg font-bold tracking-tighter text-primary-container">
            סופר צמיג
          </p>
          <h1 className="mt-2 font-headline text-headline-md text-on-surface">
            כניסה למערכת הניהול
          </h1>
          <p className="mt-1 text-body-md text-on-surface-variant">
            אזור מוגבל לצוות המוסך בלבד.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          <TextInput
            label="אימייל"
            type="email"
            dir="ltr"
            autoComplete="username"
            required
            value={values.email}
            error={errors.email}
            onChange={setField('email')}
          />

          <TextInput
            label="סיסמה"
            type="password"
            dir="ltr"
            autoComplete="current-password"
            required
            value={values.password}
            error={errors.password}
            onChange={setField('password')}
          />

          {submission.isError && (
            <p
              role="alert"
              className="flex items-center gap-2 rounded-lg border border-error/40 bg-error-container/15 px-4 py-3 text-body-md text-error"
            >
              <Icon name="error" size={18} />
              {submission.error.userMessage}
            </p>
          )}

          <Button type="submit" fullWidth size="lg" loading={submission.isSubmitting} icon="login">
            כניסה מאובטחת
          </Button>
        </form>

        {import.meta.env.DEV && (
          <p
            dir="ltr"
            className="mt-6 rounded-lg border border-outline-variant/40 bg-surface-container/60 p-3 text-center text-label-sm text-on-surface-variant"
          >
            dev only · admin@supertzmieg.co.il / SuperTzmieg!24
          </p>
        )}
      </GlassCard>
    </div>
  )
}
