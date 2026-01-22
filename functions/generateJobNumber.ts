import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get current year
        const year = new Date().getFullYear();
        
        // Find all jobs from this year to determine next number
        const existingJobs = await base44.asServiceRole.entities.Job.filter({});
        
        // Filter jobs from current year and extract sequence numbers
        const yearPrefix = `J-${year}-`;
        const jobsThisYear = existingJobs
            .filter(j => j.job_number?.startsWith(yearPrefix))
            .map(j => {
                const parts = j.job_number.split('-');
                return parseInt(parts[2]) || 0;
            })
            .filter(n => !isNaN(n));
        
        // Get next sequence number
        const nextNumber = jobsThisYear.length > 0 
            ? Math.max(...jobsThisYear) + 1 
            : 1;
        
        // Format as J-YYYY-###
        const jobNumber = `${yearPrefix}${String(nextNumber).padStart(3, '0')}`;
        
        return Response.json({ job_number: jobNumber });
        
    } catch (error) {
        console.error('Error generating job number:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});