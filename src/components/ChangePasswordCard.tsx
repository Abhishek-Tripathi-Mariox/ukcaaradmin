import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { authAPI } from '@/services/api';

export function ChangePasswordCard() {
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirmPassword, setConfirm] = useState('');
  const [show, setShow] = useState(false);

  const mutation = useMutation({
    mutationFn: () => authAPI.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      toast.success('Password changed successfully');
      setCurrent('');
      setNew('');
      setConfirm('');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to change password');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      toast.error('All fields are required');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 max-w-xl">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Lock className="w-5 h-5" /> Change password
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Current password
          </label>
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrent(e.target.value)}
              className="input pr-10"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            New password
          </label>
          <input
            type={show ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNew(e.target.value)}
            className="input"
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Confirm new password
          </label>
          <input
            type={show ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirm(e.target.value)}
            className="input"
            autoComplete="new-password"
          />
        </div>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="btn btn-primary"
        >
          {mutation.isPending ? 'Updating...' : 'Update password'}
        </button>
      </form>
    </div>
  );
}
