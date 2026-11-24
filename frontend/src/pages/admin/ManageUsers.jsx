import { useEffect, useState } from 'react'
import { getUsers, suspendUser } from '../../api'
import { PageHeader, DataTable, Badge } from '../../components/ui'
import { ImmersiveScreen, FloatingPanel } from '../../components/shell/AsymmetricWorkspace'

export default function ManageUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState(null)

  const loadUsers = () => {
    getUsers().then((res) => setUsers(res.data.users || [])).finally(() => setLoading(false))
  }

  useEffect(() => { loadUsers() }, [])

  const toggleStatus = async (user) => {
    setActingId(user.user_id)
    try {
      await suspendUser(user.user_id, { action: user.is_active ? 'suspend' : 'activate' })
      loadUsers()
    } finally {
      setActingId(null)
    }
  }

  return (
    <ImmersiveScreen mapLabel="Users">
      <FloatingPanel width="lg">
        <PageHeader title="Users" subtitle="View and moderate accounts" />
        {loading && <p className="text-zinc-500">Loading...</p>}
        <DataTable columns={['ID', 'Name', 'Email', 'Role', 'Status', 'Actions']}>
          {users.map((user) => (
            <tr key={user.user_id}>
              <td className="font-mono text-xs">{user.user_id}</td>
              <td className="font-medium">{user.name}</td>
              <td>{user.email}</td>
              <td className="capitalize">{user.role}</td>
              <td>
                <Badge variant={user.is_active ? 'success' : 'danger'}>
                  {user.is_active ? 'Active' : 'Suspended'}
                </Badge>
              </td>
              <td>
                {user.role !== 'admin' && (
                  <button
                    type="button"
                    disabled={actingId === user.user_id}
                    onClick={() => toggleStatus(user)}
                    className="link-accent text-xs"
                  >
                    {user.is_active ? 'Suspend' : 'Activate'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      </FloatingPanel>
    </ImmersiveScreen>
  )
}
