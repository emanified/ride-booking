import { createContext, useContext, useState, useEffect } from 'react'
import api, { login as loginRequest } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const role = localStorage.getItem('role')
    const email = localStorage.getItem('email')
    const name = localStorage.getItem('name')
    const userId = localStorage.getItem('user_id')

    if (token && role) {
      setUser({ token, role, email, name, user_id: userId ? Number(userId) : undefined })
      api.defaults.headers.common.Authorization = `Bearer ${token}`
    }
    setLoading(false)
  }, [])

  const login = async (email, password) => {
    try {
      const res = await loginRequest({ email, password })

      if (res.data.token && res.data.user) {
        const { token, user: userData } = res.data

        localStorage.setItem('token', token)
        localStorage.setItem('role', userData.role)
        localStorage.setItem('email', userData.email)
        localStorage.setItem('name', userData.name ?? '')
        localStorage.setItem('user_id', String(userData.user_id))

        api.defaults.headers.common.Authorization = `Bearer ${token}`
        setUser({
          token,
          role: userData.role,
          email: userData.email,
          name: userData.name,
          user_id: userData.user_id,
        })
        return { success: true, role: userData.role }
      }
    } catch (err) {
      return { success: false, message: err.response?.data?.error || 'Login failed' }
    }
    return { success: false, message: 'Login failed' }
  }

  const logout = () => {
    localStorage.clear()
    delete api.defaults.headers.common.Authorization
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
