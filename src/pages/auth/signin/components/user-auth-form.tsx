import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom'; // Add this import at the top if not present

const formSchema = z.object({
  email: z.string().email({ message: 'Enter a valid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' })
});

type UserFormValue = z.infer<typeof formSchema>;

export default function UserAuthForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const defaultValues = {
    email: '',
    password: ''
  };
  
  const form = useForm<UserFormValue>({
    resolver: zodResolver(formSchema),
    defaultValues
  });

  const onSubmit = async (data: UserFormValue) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, data.email, data.password);
      
      // Check if user intended to subscribe to a plan
      const intendedSubscription = localStorage.getItem('intendedSubscription');
      if (intendedSubscription) {
        localStorage.removeItem('intendedSubscription');
        navigate('/dashboard/ManageSubscription', { 
          state: { selectedPlan: intendedSubscription } 
        });
      } else {
        navigate('/dashboard');
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Sign in failed",
        description: error.message || "Please check your credentials"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="w-[400px] space-y-4"
        >
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="ml-1">Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="Enter email"
                    disabled={loading}
                      className="border-white/15 focus-visible:ring-[#94bba3]/30 focus-visible:ring-1 focus-visible:ring-offset-0"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="ml-1">Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Enter password"
                    disabled={loading}
                      className="border-white/15 focus-visible:ring-[#94bba3]/30 focus-visible:ring-1 focus-visible:ring-offset-0"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
<div className="space-y-4 text-center text-sm text-muted-foreground mt-2">
  <p>
    <Link
      to="/auth/forgot-password"
      className="underline underline-offset-4 hover:text-white"
    >
      Forgot password?
    </Link>
  </p>
</div>

          <div className="flex justify-center">
            <Button 
              disabled={loading} 
              type="submit"
              className="h-9 px-6 bg-transparent border border-white/15 hover:bg-[#94bba3]/20 transition-transform"
            >
              {loading ? (
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : "Sign In"}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
}
