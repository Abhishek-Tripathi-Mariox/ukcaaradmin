import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Car, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { authAPI } from '@/services/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email');
      return;
    }
    setLoading(true);
    try {
      await authAPI.forgotPassword(email);
      toast.success('If an account exists for that email, a reset code has been sent.');
      navigate(`/reset-password?email=${encodeURIComponent(email)}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to send reset code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
            <Car className="w-8 h-8 text-primary-600" />
          </div>
          <h1 className="text-3xl font-bold text-white">UKCAAR</h1>
          <p className="text-primary-200 mt-1">Admin Panel</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Forgot password?</h2>
          <p className="text-sm text-gray-500 mb-6">
            Enter your admin email and we'll send a reset code.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="admin@ukcaar.com"
                autoComplete="email"
                autoFocus
              />
            </div>

            <button type="submit" disabled={isLoading} className="btn btn-primary w-full py-3">
              {isLoading ? 'Sending...' : 'Send reset code'}
            </button>

            <Link
              to="/login"
              className="flex items-center justify-center gap-1 text-sm text-primary-600 hover:underline"
            >
              <ArrowLeft className="w-4 h-4" /> Back to sign in
            </Link>
          </form>
        </div>
      </div>
    </div>
  );
}
