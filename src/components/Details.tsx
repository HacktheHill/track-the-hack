import { trpc } from "../utils/api";

type DetailsProps = {
    id: string;
};

const Details = ({ id }: DetailsProps) => {
    const hacker = trpc.hackers.get.useQuery({ id }).data;

    return (
        <>
            {hacker && (
                <>
                    <p>First Name: {hacker.firstName}</p>
                    <p>Last Name: {hacker.lastName}</p>
                </>
            )}
        </>
    );
};

export default Details;
