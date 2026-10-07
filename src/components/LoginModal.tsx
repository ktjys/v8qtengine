import React, { useState } from 'react';
import {
  Mail,
  Shield,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Lock,
  KeyRound,
  Loader2,
  X,
  Send,
  LogOut,
  Copy,
  Check,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (msg: string) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
}) => {
  const {
    user,
    session,
    signInWithOtp,
    signOut,
    verifyRecoveryCode,
    generateRecoveryCode,
    recoveryCode,
    configuredAdminEmail,
    error,
    clearError,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'magic_link' | 'recovery_code'>('recovery_code');
  const [email, setEmail] = useState(configuredAdminEmail || 'kanada250@gmail.com');
  const [recoveryCodeInput, setRecoveryCodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [generatedCodeLocal, setGeneratedCodeLocal] = useState<string | null>(null);

  if (!isOpen) return null;

  const isAuthenticated = Boolean(user && session);

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      onShowToast('이메일 주소를 입력해주세요.');
      return;
    }

    setLoading(true);
    clearError();
    try {
      const { error: otpErr } = await signInWithOtp(cleanEmail);
      if (otpErr) {
        onShowToast(`발송 실패: ${otpErr.message}`);
      } else {
        setOtpSent(true);
        onShowToast('이메일로 로그인 링크가 전송되었습니다. 편지함을 확인하세요.');
      }
    } catch (err: any) {
      onShowToast(`오류 발생: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyRecoveryCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = recoveryCodeInput.trim().toUpperCase();
    if (!cleanCode) {
      onShowToast('복구 코드 또는 관리자 패스키를 입력해주세요.');
      return;
    }

    setLoading(true);
    clearError();
    try {
      const { success, error: verifyErr } = await verifyRecoveryCode(cleanCode);
      if (success) {
        onShowToast('소유자 인증 완료! 관리자 세션이 활성화되었습니다.');
        setRecoveryCodeInput('');
      } else {
        onShowToast(`검증 실패: ${verifyErr || '유효하지 않은 코드입니다.'}`);
      }
    } catch (err: any) {
      onShowToast(`오류 발생: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateRecoveryCode = async () => {
    setLoading(true);
    try {
      const res = await generateRecoveryCode();
      if (res.code) {
        setGeneratedCodeLocal(res.code);
        onShowToast('새로운 8자리 긴급 복구 코드가 발급되었습니다!');
      } else {
        onShowToast(`발급 실패: ${res.error || '알 수 없는 오류'}`);
      }
    } catch (err: any) {
      onShowToast(`발급 오류: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = (codeToCopy: string) => {
    navigator.clipboard.writeText(codeToCopy);
    setCopiedCode(true);
    onShowToast('복구 코드가 클립보드에 복사되었습니다.');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await signOut();
      onShowToast('소유자 세션이 안전하게 종료되었습니다.');
      onClose();
    } catch (err: any) {
      onShowToast(`로그아웃 오류: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-6 relative overflow-hidden">
        {/* Decorative corner glow */}
        <div
          className={`absolute top-0 right-0 w-36 h-36 rounded-full blur-2xl ${
            isAuthenticated ? 'bg-emerald-500/10' : 'bg-cyan-500/5'
          }`}
        />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div
              className={`p-2 rounded-xl border ${
                isAuthenticated
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
              }`}
            >
              {isAuthenticated ? <ShieldCheck className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                {isAuthenticated ? '소유자 인증 활성화됨' : '소유자 인증 관리'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isAuthenticated ? '시스템 관리자 권한 활성화 상태' : '관리자 전용 보안 영역 진입'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-950 text-slate-400 hover:text-white border border-slate-800/80 active:scale-95 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Authenticated View: Active Owner Dashboard */}
        {isAuthenticated ? (
          <div className="space-y-5 animate-fadeIn">
            {/* Account Card */}
            <div className="p-4 bg-slate-950/80 border border-emerald-500/30 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  인증된 소유자 계정
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                  최고 관리자
                </span>
              </div>
              <div className="flex items-center space-x-2 text-slate-200">
                <Mail className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-sm font-semibold font-mono truncate">
                  {user?.email || configuredAdminEmail}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                DB 헬스체크 DDL 실행, 백필 스캔 강제 실행, 종목 분류 수동 변경 등 모든 관리자 보안 기능이 잠금 해제되었습니다.
              </p>
            </div>

            {/* Emergency Recovery Code Section */}
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-200">
                  <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
                  <span>긴급 복구 마스터 코드</span>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateRecoveryCode}
                  disabled={loading}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 text-cyan-300 rounded-lg transition-all cursor-pointer disabled:opacity-50"
                >
                  {loading ? '발급 중...' : '새 코드 발급'}
                </button>
              </div>

              {generatedCodeLocal || recoveryCode ? (
                <div className="p-3 bg-slate-900 border border-cyan-500/40 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-cyan-400 font-semibold flex items-center space-x-1">
                      <Sparkles className="w-3 h-3" />
                      <span>1회용 비상 복구 코드 (8자리)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyCode(generatedCodeLocal || recoveryCode || '')}
                      className="flex items-center space-x-1 text-[10px] text-slate-300 hover:text-white px-2 py-0.5 rounded bg-slate-800 transition-colors"
                    >
                      {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedCode ? '복사됨' : '복사'}</span>
                    </button>
                  </div>
                  <div className="text-center font-mono font-bold text-lg tracking-widest text-white py-1 bg-black/40 rounded-lg border border-slate-800">
                    {generatedCodeLocal || recoveryCode}
                  </div>
                  <p className="text-[10px] text-rose-300 leading-tight">
                    ※ 1회 사용 시 즉시 만료됩니다. 이메일 서버 장애 시 대비하여 별도 안전한 곳에 보관하세요.
                  </p>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  이메일 확인이 불가능한 긴급 상황에 대비하여 8자리 일회성 복구 코드를 발급받아 안전한 곳에 보관할 수 있습니다.
                </p>
              )}
            </div>

            {/* Logout Action */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loading}
                className="flex items-center space-x-1.5 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-semibold transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <LogOut className="w-3.5 h-3.5" />
                )}
                <span>소유자 세션 종료 (로그아웃)</span>
              </button>
            </div>
          </div>
        ) : (
          /* Unauthenticated View: Login Forms */
          <div className="space-y-6">
            {/* Tab Segmented Control */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('recovery_code');
                  clearError();
                }}
                className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'recovery_code'
                    ? 'bg-slate-800 text-cyan-400 shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>복구 코드 / 패스키</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('magic_link');
                  clearError();
                }}
                className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'magic_link'
                    ? 'bg-slate-800 text-cyan-400 shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>이메일 링크</span>
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start space-x-2 text-rose-400 text-xs leading-relaxed animate-fadeIn">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {activeTab === 'recovery_code' ? (
              <form onSubmit={handleVerifyRecoveryCode} className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="recovery-code"
                    className="text-[11px] font-bold text-slate-400 uppercase tracking-wider"
                  >
                    마스터 복구 코드 또는 패스키
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      id="recovery-code"
                      type="text"
                      value={recoveryCodeInput}
                      onChange={(e) => setRecoveryCodeInput(e.target.value)}
                      placeholder="8자리 복구코드 또는 ADMIN_PASSKEY"
                      required
                      disabled={loading}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-xs font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/20 transition-all font-mono tracking-wider text-center"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    발급받은 8자리 복구 코드나 환경변수 <code className="text-slate-400 font-mono">ADMIN_PASSKEY</code>를 입력하시면 즉시 인증 세션이 열립니다.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 active:scale-98 text-white py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-cyan-600/10 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>코드 대조 및 세션 수립 중...</span>
                    </>
                  ) : (
                    <>
                      <Shield className="w-3.5 h-3.5" />
                      <span>세션 잠금 해제</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSendMagicLink} className="space-y-4">
                {otpSent ? (
                  <div className="p-4 bg-cyan-950/40 border border-cyan-800/40 rounded-2xl text-center space-y-3 animate-fadeIn">
                    <div className="w-12 h-12 bg-cyan-500/10 rounded-full flex items-center justify-center mx-auto text-cyan-400 border border-cyan-500/20">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-white">매직 링크가 발송되었습니다</h4>
                      <p className="text-[10px] text-slate-400 leading-relaxed max-w-xs mx-auto">
                        수신 이메일: <strong className="text-cyan-300 font-mono">{email}</strong>
                        <br />
                        이메일의 <b>[로그인 링크]</b>를 클릭하시면 세션이 열립니다.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOtpSent(false)}
                      className="text-[10px] text-slate-400 hover:text-cyan-300 underline underline-offset-2 cursor-pointer"
                    >
                      이메일 주소 다시 적기
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <label
                        htmlFor="login-email"
                        className="text-[11px] font-bold text-slate-400 uppercase tracking-wider"
                      >
                        관리자 이메일 주소
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                          id="login-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="kanada250@gmail.com"
                          required
                          disabled={loading}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-xs font-semibold text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/20 transition-all font-mono"
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 leading-relaxed">
                        Supabase 이메일 OTP로 로그인 링크를 발송합니다.
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex items-center justify-center space-x-2 bg-cyan-600 hover:bg-cyan-500 active:scale-98 text-white py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-cyan-600/20 transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>메시지 전송 중...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>매직 링크(로그인 링크) 전송</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};