import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";

const Login = ({ onLogin }) => {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await api.post("/auth/login", form);
      onLogin(response.data.token, response.data.user);
      const role = response.data.user?.role;
      if (role === "admin") navigate("/admin/dashboard");
      else if (role === "guide") navigate("/guide/dashboard");
      else navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 px-4 dark:from-gray-900 dark:via-purple-900/20 dark:to-indigo-900/30">
      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-purple-300 opacity-30 blur-3xl animate-pulse dark:bg-purple-600"></div>
        <div className="absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-indigo-300 opacity-30 blur-3xl animate-pulse delay-1000 dark:bg-indigo-600"></div>
        <div className="absolute left-1/3 top-1/2 h-60 w-60 rounded-full bg-pink-300 opacity-20 blur-3xl animate-pulse delay-700 dark:bg-pink-600"></div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md rounded-2xl border border-white/20 bg-white/80 p-8 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:shadow-3xl dark:border-gray-700/50 dark:bg-gray-800/80"
      >
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 shadow-lg">
            <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent dark:from-white dark:to-gray-300">
            Welcome Back
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Log in to your workspace
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-rose-100/90 p-3 text-sm text-rose-800 backdrop-blur-sm dark:bg-rose-900/40 dark:text-rose-200">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Email Address</label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                </svg>
              </div>
              <input
                className="w-full rounded-xl border border-gray-300 bg-white/50 pl-10 pr-4 py-2.5 text-gray-900 placeholder-gray-400 transition-all duration-200 focus:border-purple-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/40 dark:border-gray-600 dark:bg-gray-900/50 dark:text-white dark:placeholder-gray-500 dark:focus:bg-gray-900"
                placeholder="you@example.com"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <input
                className="w-full rounded-xl border border-gray-300 bg-white/50 pl-10 pr-4 py-2.5 text-gray-900 placeholder-gray-400 transition-all duration-200 focus:border-purple-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/40 dark:border-gray-600 dark:bg-gray-900/50 dark:text-white dark:placeholder-gray-500 dark:focus:bg-gray-900"
                placeholder="••••••••"
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                required
              />
            </div>
          </div>
        </div>

         
        <button
          type="submit"
          disabled={loading}
          className="group mt-6 w-full transform rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5 font-semibold text-white shadow-lg transition-all duration-200 hover:scale-[1.02] hover:from-purple-700 hover:to-indigo-700 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-60 disabled:hover:scale-100"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Logging in...
            </span>
          ) : (
            "Sign In"
          )}
        </button>

        {/* <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white/80 px-2 text-gray-500 backdrop-blur-sm dark:bg-gray-800/80 dark:text-gray-400">or continue with</span>
          </div>
        </div> */}

        

        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          Don't have an account?{" "}
          <Link to="/signup" className="font-semibold text-purple-600 transition-colors hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300">
            Create account
          </Link>
        </p>
      </form>
    </div>
  );
};

export default Login;