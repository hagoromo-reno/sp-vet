import React from 'react';
import { AuthScreen } from './AuthScreen';

export const LoginModal: React.FC<{ isOpen?: boolean }> = () => {
  return <AuthScreen />;
};

export default LoginModal;
