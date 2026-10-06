import React, { useState } from 'react';
import { Mail, Shield, AlertTriangle, CheckCircle2, Lock, KeyRound, Loader2, X, Send } from 'lucide-react';
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
  const { signInWithOtp, verifyRecoveryCode, error, clearError } = useAuth();
  const [activeTab, setActiveTab] = useState<'magic_link' | 'recovery_code'>('magic_link');
  const [email, setEmail] = useState('');
  const [recoveryCodeInput, setRecoveryCodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  if (!isOpen) return null;

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
    if (cleanCode.length !== 8) {
      onShowToast('8자리 복구 코드를 정확히 입력해주세요.');
      return;
    }

    setLoading(true);
    clearError();
    try {
      const { success, error: verifyErr } = await verifyRecoveryCode(cleanCode);
      if (success) {
        onShowToast('복구 코드가 확인되었습니다! 이제 이메일 로그인 없이 세션이 복구됩니다.');
        // 세션 갱신/강제 로그인 처리를 위해 리로드
        setTimeout(() => window.location.reload(), 1500);
        onClose();
      } else {
        onShowToast(`검증 실패: ${verifyErr || '유효하지 않은 코드입니다.'}`);
      }
    } catch (err: any) {
      onShowToast(`오류 발생: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-6 relative overflow-hidden">
        {/* Decorative corner glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl" />

        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3 text-cyan-400">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">소유자 인증 관리</h3>
              <p className="text-[11px] text-slate-400">관리자 전용 보안 영역 진입</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-950 text-slate-400 hover:text-white border border-slate-800/80 active:scale-95 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Segmented Control */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => {
              setActiveTab('magic_link');
              clearError();
            }}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'magic_link'
                ? 'bg-slate-800 text-cyan-400 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>이메일 로그인</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('recovery_code');
              clearError();
            }}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'recovery_code'
                ? 'bg-slate-800 text-cyan-400 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>복구 코드로 진입</span>
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start space-x-2 text-rose-400 text-xs leading-relaxed animate-fadeIn">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {activeTab === 'magic_link' ? (
          <form onSubmit={handleSendMagicLink} className="space-y-4">
            {otpSent ? (
              <div className="p-4 bg-cyan-950/40 border border-cyan-800/40 rounded-2xl text-center space-y-3 animate-fadeIn">
                <div className="w-12 h-12 bg-cyan-500/10 rounded-full flex items-center justify-center mx-auto text-cyan-400 border border-cyan-500/20">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-white">매직 링크가 발송되었습니다</h4>
                  <p className="text-[10px] text-slate-400 leading-relaxed max-w-xs mx-auto">
                    수신 이메일: <strong className="text-cyan-300 font-mono">{email}</strong><br />
                    이메일 안에 포함된 <b>[로그인 링크]</b>를 클릭하시면 브라우저에서 자동으로 인증 세션이 열립니다. 이 창은 닫으셔도 좋습니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOtpSent(false)}
                  className="text-[10px] text-slate-400 hover:text-cyan-300 underline underline-offset-2"
                >
                  이메일 주소 다시 적기
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label htmlFor="login-email" className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    관리자 이메일 주소
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@example.com"
                      required
                      disabled={loading}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-xs font-semibold text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/20 transition-all font-mono"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    시스템 환경 변수(<code className="font-mono text-slate-400">ADMIN_EMAIL</code>)에 설정된 이메일 주소로만 연동 로그인 링크가 전송됩니다.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center space-x-2 bg-cyan-600 hover:bg-cyan-500 active:scale-98 text-white py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-cyan-600/20 transition-all disabled:opacity-50"
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
        ) : (
          <form onSubmit={handleVerifyRecoveryCode} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="recovery-code" className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                8자리 마스터 복구 코드
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  id="recovery-code"
                  type="text"
                  maxLength={8}
                  value={recoveryCodeInput}
                  onChange={(e) => setRecoveryCodeInput(e.target.value)}
                  placeholder="A1B2C3D4"
                  required
                  disabled={loading}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-xs font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/20 transition-all font-mono uppercase tracking-widest text-center"
                />
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                비밀번호 분실 또는 이메일 서버 차단 시 사용하는 8자리 비상 코드입니다. 사용 시 해당 코드는 즉시 일회성으로 만료됩니다.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 active:scale-98 text-white py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-cyan-600/10 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>복구 코드 대조 중...</span>
                </>
              ) : (
                <>
                  <Shield className="w-3.5 h-3.5" />
                  <span>복구 코드로 세션 잠금 해제</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};