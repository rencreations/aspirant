import numpy as np
def qmul(a,b):
    aw,ax,ay,az=a; bw,bx,by,bz=b
    return np.array([aw*bw-ax*bx-ay*by-az*bz, aw*bx+ax*bw+ay*bz-az*by, aw*by-ax*bz+ay*bw+az*bx, aw*bz+ax*by-ay*bx+az*bw])
def qinv(a): return np.array([a[0],-a[1],-a[2],-a[3]])/np.dot(a,a)
def qrot(q,v):
    qv=np.array([0,*v]); return qmul(qmul(q,qv),qinv(q))[1:]
def qnorm(q): return q/np.linalg.norm(q)
def qslerp(a,b,t):
    d=np.dot(a,b)
    if d<0: b=-b; d=-d
    if d>0.9995: return qnorm(a+(b-a)*t)
    th=np.arccos(d); s=np.sin(th)
    return (np.sin((1-t)*th)*a+np.sin(t*th)*b)/s
def qaxisangle(axis,ang):
    axis=np.array(axis,float); axis/=np.linalg.norm(axis); return np.array([np.cos(ang/2),*(np.sin(ang/2)*axis)])
def qfromto(a,b):
    a=np.array(a,float)/np.linalg.norm(a); b=np.array(b,float)/np.linalg.norm(b)
    d=np.dot(a,b)
    if d>0.999999: return np.array([1,0,0,0.])
    if d<-0.999999:
        ax=np.cross(a,[1,0,0]); 
        if np.linalg.norm(ax)<1e-3: ax=np.cross(a,[0,1,0])
        return qaxisangle(ax,np.pi)
    ax=np.cross(a,b); q=np.array([1+d,*ax]); return qnorm(q)
